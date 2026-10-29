import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import CalendarPicker from "react-native-calendar-picker";
import { Button, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { months, weekdays } from "../../../defaultData";
import { useFinance } from "../../contexts/FinanceContext";
import { useProfile } from "../../contexts/ProfileContext";
import { Receipt, TransactionType } from "../../db/interfaces";
import { pickReceiptImage } from "../../helpers/receiptFiles";
import { parsePickedDate, toIsoDate } from "../../helpers/dates";
import { formatPln, parseAmount } from "../../helpers/money";
import CategoryPicker from "../../components/CategoryPicker";
import OwnerPicker from "../../components/OwnerPicker";
import ReceiptAttach from "../../components/ReceiptAttach";
import ReceiptPreviewModal from "../../components/ReceiptPreviewModal";
import { useAccent } from "../../contexts/ThemeContext";
import { ownerLabel } from "../../helpers/owners";
import { howManySaved, totalExpenses, totalIncomings } from "./helpers/countSum";

const ExpensesIndexScreen: React.FC = () => {
  const { accent, surfaces } = useAccent();
  const { profile, members } = useProfile();
  const { entries, receipts, addEntry, removeEntry, addReceiptsToEntry, removeReceipt } = useFinance();
  const [selectedStartDate, setSelectedStartDate] = useState<Date>(new Date());
  const [formType, setFormType] = useState<TransactionType | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [memberId, setMemberId] = useState<number | null>(null);
  const [pendingReceipts, setPendingReceipts] = useState<string[]>([]);
  const [openReceipt, setOpenReceipt] = useState<Receipt | null>(null);
  const isFamily = profile?.accountType === "family";

  const selectedIso = toIsoDate(selectedStartDate);
  const dayEntries = useMemo(
    () => entries.filter((entry) => !entry.regular && entry.date === selectedIso),
    [entries, selectedIso]
  );

  const spent = totalExpenses(dayEntries);
  const incoming = totalIncomings(dayEntries);
  const dailySaldo =
    profile?.accountType === "family"
      ? members.reduce((sum, member) => sum + (member.dailySaldo ?? 0), 0)
      : profile?.dailySaldo ?? 100;
  const saved = howManySaved(incoming, spent, dailySaldo);

  const canSave = Boolean(formType && category) && parseAmount(amount) !== null;

  const resetForm = () => {
    setName("");
    setCategory("");
    setAmount("");
    setMemberId(null);
    setFormType(null);
    setPendingReceipts([]);
  };

  const saveEntry = async () => {
    const parsed = parseAmount(amount);
    if (!formType || !category || parsed === null) return;
    try {
      await addEntry(
        {
          date: selectedIso,
          type: formType,
          name: name.trim(),
          category,
          amount: parsed,
          regular: false,
          memberId,
        },
        { receiptUris: formType === "expense" ? pendingReceipts : undefined }
      );
      resetForm();
    } catch (error) {
      console.error(error);
      Alert.alert("Nie udało się zapisać", "Spróbuj dodać wydatek jeszcze raz.");
    }
  };

  const selectFormType = (type: TransactionType) => {
    setFormType((current) => (current === type ? null : type));
    setCategory("");
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <CalendarPicker
        key={accent}
        startFromMonday={true}
        selectedDayColor={surfaces.selectedDay}
        selectedDayTextColor={surfaces.selectedDayText}
        todayBackgroundColor={surfaces.today}
        months={months}
        weekdays={weekdays}
        selectMonthTitle={months[selectedStartDate.getMonth()] + " " + selectedStartDate.getFullYear()}
        previousTitle={"←"}
        nextTitle={"→"}
        selectedStartDate={selectedStartDate}
        onDateChange={(date) => {
          if (date) setSelectedStartDate(parsePickedDate(date));
        }}
        nextTitleStyle={{ fontSize: 20 }}
        previousTitleStyle={{ fontSize: 20 }}
        monthTitleStyle={{ fontSize: 18 }}
        yearTitleStyle={{ fontSize: 18 }}
        selectedDayTextStyle={{ fontSize: 14 }}
        textStyle={{ fontSize: 14 }}
      />

      <View style={styles.actions}>
        <Pressable
          style={[styles.actionButton, formType === "expense" && { borderColor: accent, backgroundColor: surfaces.surfaceStrong }]}
          onPress={() => selectFormType("expense")}
        >
          <MaterialCommunityIcons name="minus-circle-outline" size={20} color={accent} />
          <Text style={[styles.actionLabel, { color: accent }]}>Wydatek</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, formType === "income" && { borderColor: accent, backgroundColor: surfaces.surfaceStrong }]}
          onPress={() => selectFormType("income")}
        >
          <MaterialCommunityIcons name="plus-circle-outline" size={20} color={accent} />
          <Text style={[styles.actionLabel, { color: accent }]}>Wpływ</Text>
        </Pressable>
      </View>

      {formType ? (
        <View style={styles.form}>
          <Text style={styles.formTitle}>
            {formType === "expense" ? "Nowy wydatek" : "Nowy wpływ"}
          </Text>
          {isFamily ? (
            <OwnerPicker members={members} value={memberId} onChange={setMemberId} />
          ) : null}
          <TextInput
            mode="outlined"
            label="Kwota"
            placeholder="np. 45"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            style={styles.input}
            outlineColor="#d7c8d3"
            activeOutlineColor={accent}
          />
          <TextInput
            mode="outlined"
            label="Nazwa (opcjonalnie)"
            placeholder={formType === "expense" ? "np. Lidl" : "np. Premia za kwartał"}
            value={name}
            onChangeText={setName}
            style={styles.input}
            outlineColor="#d7c8d3"
            activeOutlineColor={accent}
          />
          <CategoryPicker type={formType} value={category} onChange={setCategory} />
          {formType === "expense" ? (
            <ReceiptAttach uris={pendingReceipts} onChange={setPendingReceipts} />
          ) : null}
          <Button
            mode="contained"
            onPress={saveEntry}
            disabled={!canSave}
            buttonColor={accent}
            textColor="#fff"
            style={styles.saveButton}
          >
            Zapisz
          </Button>
        </View>
      ) : null}

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryLine}>Wydano dzisiaj: {formatPln(spent)}</Text>
        <Text style={styles.summaryLine}>Przybyło dzisiaj: {formatPln(incoming)}</Text>
        <Text style={styles.summaryLine}>Dzisiejsze saldo: {formatPln(dailySaldo)}</Text>
        <Text style={styles.summaryLine}>
          {saved > 0
            ? `Udało się zaoszczędzić ${formatPln(saved)}`
            : "Niestety nie udało się nic zaoszczędzić"}
        </Text>

        {dayEntries.length === 0 ? (
          <Text style={styles.empty}>Nie dodano wydatków ani wpływów na dany dzień</Text>
        ) : (
          <View style={styles.list}>
            {dayEntries.map((item) => {
              const itemReceipts = receipts.filter((receipt) => receipt.entryId === item.id);
              const firstReceipt = itemReceipts[0];
              return (
              <View key={item.id} style={[styles.row, { backgroundColor: surfaces.surface, borderColor: surfaces.border }]}>
                {firstReceipt ? (
                  <Pressable onPress={() => setOpenReceipt(firstReceipt)}>
                    <Image source={{ uri: firstReceipt.uri }} style={styles.rowThumb} />
                  </Pressable>
                ) : null}
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{item.name || item.category}</Text>
                  <Text style={styles.rowMeta}>
                    {item.category} · {item.type === "expense" ? "Wydatek" : "Wpływ"} · {formatPln(item.amount)}
                    {isFamily ? ` · ${ownerLabel(item.memberId, members)}` : ""}
                    {itemReceipts.length > 1 ? ` · ${itemReceipts.length} paragony` : ""}
                  </Text>
                </View>
                {item.type === "expense" ? (
                  <Pressable
                    onPress={() => {
                      void (async () => {
                        const uri = await pickReceiptImage();
                        if (uri) await addReceiptsToEntry(item, [uri]);
                      })();
                    }}
                    hitSlop={8}
                  >
                    <MaterialCommunityIcons name="camera-plus-outline" size={22} color={accent} />
                  </Pressable>
                ) : null}
                <Pressable onPress={() => removeEntry(item.id)} hitSlop={8}>
                  <MaterialCommunityIcons name="close-circle" size={22} color="#9a8a96" />
                </Pressable>
              </View>
            );
            })}
          </View>
        )}
      </View>
    </ScrollView>
    <ReceiptPreviewModal
      receipt={openReceipt}
      onClose={() => setOpenReceipt(null)}
      onDelete={(id) => {
        Alert.alert("Usunąć paragon?", "Zdjęcie zniknie z wydatku i z zakładki Paragony.", [
          { text: "Anuluj", style: "cancel" },
          {
            text: "Usuń",
            style: "destructive",
            onPress: () => {
              setOpenReceipt(null);
              void removeReceipt(id);
            },
          },
        ]);
      }}
    />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 15,
    paddingBottom: 120,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#eadfe6",
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  actionLabel: {
    fontFamily: "MontserratSemiBold",
    fontSize: 15,
  },
  form: {
    marginTop: 14,
  },
  formTitle: {
    fontFamily: "MontserratSemiBold",
    fontSize: 16,
    marginBottom: 10,
    color: "#1f1220",
  },
  input: {
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  saveButton: {
    borderRadius: 12,
    marginTop: 4,
  },
  summaryContainer: {
    paddingVertical: 20,
  },
  summaryLine: {
    fontFamily: "PoppinsRegular",
    fontSize: 15,
    color: "#1f1220",
    marginBottom: 6,
  },
  empty: {
    fontFamily: "PoppinsRegular",
    color: "#6b5f6a",
    marginTop: 12,
  },
  list: {
    marginTop: 14,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#eadfe6",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#fdf8fb",
  },
  rowThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#eadfe6",
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: "MontserratSemiBold",
    fontSize: 16,
    color: "#1f1220",
  },
  rowMeta: {
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    color: "#6b5f6a",
    marginTop: 2,
  },
});

export default ExpensesIndexScreen;
