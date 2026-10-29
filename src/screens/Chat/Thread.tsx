import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import CategoryPicker from "../../components/CategoryPicker";
import OwnerPicker from "../../components/OwnerPicker";
import { useChat } from "../../contexts/ChatContext";
import { useProfile } from "../../contexts/ProfileContext";
import { useAccent } from "../../contexts/ThemeContext";
import { ChatPlan, TransactionType } from "../../db/interfaces";
import { parsePickedDate, toIsoDate } from "../../helpers/dates";
import { formatPln, parseAmount } from "../../helpers/money";
import { ownerLabel } from "../../helpers/owners";
import { setActiveChatTopic } from "../../notifications/chatPush";

type Props = NativeStackScreenProps<
  { ChatThread: { topicId: string; title: string } },
  "ChatThread"
>;

function formatDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const ThreadScreen: React.FC<Props> = ({ route, navigation }) => {
  const { topicId, title } = route.params;
  const headerHeight = useHeaderHeight();
  const { accent, surfaces } = useAccent();
  const { members, profile } = useProfile();
  const { messages, sendMessage, sendPlan } = useChat();
  const scrollRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState("");
  const [planType, setPlanType] = useState<TransactionType | null>(null);
  const [planName, setPlanName] = useState("");
  const [planCategory, setPlanCategory] = useState("");
  const [planAmount, setPlanAmount] = useState("");
  const [planDate, setPlanDate] = useState(toIsoDate(new Date()));
  const [planMemberId, setPlanMemberId] = useState<number | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const showOwner = profile?.accountType === "family" || profile?.accountType === "business";
  const thread = useMemo(
    () => messages.filter((item) => item.topicId === topicId),
    [messages, topicId]
  );

  useEffect(() => {
    navigation.setOptions({ headerTitle: title });
  }, [navigation, title]);

  useEffect(() => {
    setActiveChatTopic(topicId);
    return () => setActiveChatTopic(null);
  }, [topicId]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [thread.length]);

  const resetPlan = () => {
    setPlanType(null);
    setPlanName("");
    setPlanCategory("");
    setPlanAmount("");
    setPlanDate(toIsoDate(new Date()));
    setPlanMemberId(null);
    setDateOpen(false);
  };

  const onSendText = async () => {
    await sendMessage(topicId, draft);
    setDraft("");
  };

  const onSendPlan = async () => {
    const amount = parseAmount(planAmount);
    if (!planType || !planCategory || amount === null) {
      Alert.alert("Uzupełnij plan", "Kategoria i kwota są potrzebne.");
      return;
    }
    const plan: ChatPlan = {
      type: planType,
      name: planName.trim(),
      category: planCategory,
      amount,
      date: planDate,
      memberId: planMemberId,
      ownerName: showOwner ? ownerLabel(planMemberId, members) : undefined,
    };
    await sendPlan(topicId, plan);
    resetPlan();
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.thread}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {thread.length === 0 ? (
          <Text style={styles.empty}>Pusto. Napisz coś albo zaplanuj kwotę, zanim ktoś zdąży wydać.</Text>
        ) : (
          thread.map((item) => (
            <View key={item.id} style={[styles.bubble, { backgroundColor: surfaces.surface }]}>
              <Text style={styles.author}>{item.authorName}</Text>
              {item.plan ? (
                <View style={[styles.planCard, { borderColor: accent }]}>
                  <Text style={[styles.planKicker, { color: accent }]}>
                    {item.plan.type === "expense" ? "Zaplanowany wydatek" : "Zaplanowany wpływ"}
                  </Text>
                  <Text style={styles.planTitle}>{item.plan.name || item.plan.category}</Text>
                  <Text style={styles.planMeta}>
                    {item.plan.category} · {formatDay(item.plan.date)} · {formatPln(item.plan.amount)}
                  </Text>
                  {item.plan.ownerName || showOwner ? (
                    <Text style={styles.planMeta}>
                      Kto: {item.plan.ownerName || ownerLabel(item.plan.memberId, members)}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.body}>{item.body}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {planType ? (
        <View style={[styles.planForm, { backgroundColor: "#fff" }]}>
          <View style={styles.planHead}>
            <Text style={styles.planFormTitle}>
              {planType === "expense" ? "Zaplanuj wydatek" : "Zaplanuj wpływ"}
            </Text>
            <Pressable onPress={resetPlan} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={20} color="#6b5f6a" />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={styles.planScroll}
            contentContainerStyle={styles.planScrollContent}
          >
            {showOwner ? (
              <OwnerPicker members={members} value={planMemberId} onChange={setPlanMemberId} />
            ) : null}
            <Text style={styles.fieldLabel}>Data</Text>
            <Pressable
              onPress={() => setDateOpen(true)}
              style={[styles.dateBtn, { borderColor: surfaces.border, backgroundColor: surfaces.surface }]}
            >
              <MaterialCommunityIcons name="calendar" size={18} color={accent} />
              <Text style={styles.dateBtnText}>{formatDay(planDate)}</Text>
            </Pressable>
            <TextInput
              mode="outlined"
              label="Kwota"
              value={planAmount}
              onChangeText={setPlanAmount}
              keyboardType="decimal-pad"
              style={styles.field}
              outlineColor={surfaces.border}
              activeOutlineColor={accent}
            />
            <TextInput
              mode="outlined"
              label="Nazwa (opcjonalnie)"
              value={planName}
              onChangeText={setPlanName}
              style={styles.field}
              outlineColor={surfaces.border}
              activeOutlineColor={accent}
            />
            <CategoryPicker type={planType} value={planCategory} onChange={setPlanCategory} />
            <Pressable onPress={() => void onSendPlan()} style={[styles.sendPlan, { backgroundColor: accent }]}>
              <Text style={styles.sendPlanText}>Wrzuć do budżetu i na czat</Text>
            </Pressable>
          </ScrollView>
          <DateTimePickerModal
            isVisible={dateOpen}
            mode="date"
            date={parsePickedDate(planDate)}
            onConfirm={(picked) => {
              setPlanDate(toIsoDate(picked));
              setDateOpen(false);
            }}
            onCancel={() => setDateOpen(false)}
            confirmTextIOS="Wybierz"
            cancelTextIOS="Anuluj"
          />
        </View>
      ) : (
        <View style={styles.composer}>
          <View style={styles.planActions}>
            <Pressable onPress={() => setPlanType("expense")} style={styles.planChip}>
              <MaterialCommunityIcons name="minus-circle-outline" size={16} color={accent} />
              <Text style={[styles.planChipText, { color: accent }]}>Wydatek</Text>
            </Pressable>
            <Pressable onPress={() => setPlanType("income")} style={styles.planChip}>
              <MaterialCommunityIcons name="plus-circle-outline" size={16} color={accent} />
              <Text style={[styles.planChipText, { color: accent }]}>Wpływ</Text>
            </Pressable>
          </View>
          <View style={styles.row}>
            <TextInput
              mode="outlined"
              placeholder="Napisz do wątku…"
              value={draft}
              onChangeText={setDraft}
              style={styles.draft}
              outlineColor={surfaces.border}
              activeOutlineColor={accent}
              dense
            />
            <Pressable
              onPress={() => void onSendText()}
              disabled={!draft.trim()}
              style={[styles.send, { backgroundColor: accent, opacity: draft.trim() ? 1 : 0.5 }]}
            >
              <MaterialCommunityIcons name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  thread: { padding: 16, paddingBottom: 24, gap: 10, flexGrow: 1 },
  empty: {
    fontFamily: "PoppinsRegular",
    fontSize: 14,
    color: "#6b5f6a",
    lineHeight: 20,
  },
  bubble: {
    borderRadius: 16,
    padding: 12,
  },
  author: {
    fontFamily: "MontserratSemiBold",
    fontSize: 12,
    color: "#6b5f6a",
    marginBottom: 4,
  },
  body: {
    fontFamily: "PoppinsRegular",
    fontSize: 15,
    color: "#1f1220",
  },
  planCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  planKicker: {
    fontFamily: "MontserratSemiBold",
    fontSize: 11,
    letterSpacing: 0.3,
  },
  planTitle: {
    fontFamily: "MontserratSemiBold",
    fontSize: 16,
    color: "#1f1220",
    marginTop: 4,
  },
  planMeta: {
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    color: "#6b5f6a",
    marginTop: 2,
  },
  composer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#eadfe6",
    backgroundColor: "#fff",
  },
  planActions: { flexDirection: "row", gap: 10, marginBottom: 8 },
  planChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  planChipText: { fontFamily: "MontserratSemiBold", fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  draft: { flex: 1, backgroundColor: "#fff" },
  send: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  planForm: {
    borderTopWidth: 1,
    borderTopColor: "#eadfe6",
    maxHeight: "58%",
  },
  planHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  planFormTitle: {
    fontFamily: "MontserratSemiBold",
    fontSize: 16,
    color: "#1f1220",
  },
  planScroll: { maxHeight: 420 },
  planScrollContent: { paddingHorizontal: 14, paddingBottom: 18 },
  fieldLabel: {
    fontFamily: "MontserratSemiBold",
    fontSize: 13,
    color: "#6b5f6a",
    marginTop: 10,
    marginBottom: 6,
  },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  dateBtnText: {
    fontFamily: "PoppinsRegular",
    fontSize: 15,
    color: "#1f1220",
  },
  field: { marginTop: 8, backgroundColor: "#fff" },
  sendPlan: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  sendPlanText: {
    fontFamily: "MontserratSemiBold",
    color: "#fff",
    fontSize: 15,
  },
});

export default ThreadScreen;
