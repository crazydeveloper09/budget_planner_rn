import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import CategoryPicker from "../../components/CategoryPicker";
import OwnerPicker from "../../components/OwnerPicker";
import ReceiptAttach from "../../components/ReceiptAttach";
import { useFinance } from "../../contexts/FinanceContext";
import { useProfile } from "../../contexts/ProfileContext";
import { useAccent } from "../../contexts/ThemeContext";
import { parsePickedDate, toIsoDate } from "../../helpers/dates";
import { formatPln, parseAmount } from "../../helpers/money";

type AddReceiptModalProps = {
  visible: boolean;
  onClose: () => void;
};

function formatDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const AddReceiptModal: React.FC<AddReceiptModalProps> = ({ visible, onClose }) => {
  const { accent, surfaces } = useAccent();
  const { profile, members } = useProfile();
  const { entries, addEntry, addReceiptsToEntry } = useFinance();
  const isFamily = profile?.accountType === "family";
  const [uris, setUris] = useState<string[]>([]);
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [dateOpen, setDateOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [memberId, setMemberId] = useState<number | null>(null);
  const [linkId, setLinkId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const dayExpenses = useMemo(
    () =>
      entries.filter((entry) => !entry.regular && entry.type === "expense" && entry.date === date),
    [date, entries]
  );

  const reset = () => {
    setUris([]);
    setDate(toIsoDate(new Date()));
    setName("");
    setCategory("");
    setAmount("");
    setMemberId(null);
    setLinkId(null);
    setDateOpen(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const canSave =
    uris.length > 0 &&
    (linkId !== null || (Boolean(category) && parseAmount(amount) !== null));

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      if (linkId !== null) {
        const entry = dayExpenses.find((item) => item.id === linkId);
        if (!entry) {
          Alert.alert("Wydatek", "Wybierz wydatek z listy albo dodaj nowy.");
          return;
        }
        await addReceiptsToEntry(entry, uris);
      } else {
        const parsed = parseAmount(amount);
        if (!category || parsed === null) return;
        await addEntry(
          {
            date,
            type: "expense",
            name: name.trim(),
            category,
            amount: parsed,
            regular: false,
            memberId,
          },
          { receiptUris: uris }
        );
      }
      close();
    } catch (error) {
      console.error(error);
      Alert.alert("Paragon", "Nie udało się zapisać. Spróbuj ponownie.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.head}>
          <Text style={styles.title}>Nowy paragon</Text>
          <Pressable onPress={close} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={22} color="#6b5f6a" />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <ReceiptAttach uris={uris} onChange={setUris} />
          <Text style={styles.fieldLabel}>Data</Text>
          <Pressable
            onPress={() => setDateOpen(true)}
            style={[styles.dateBtn, { borderColor: surfaces.border, backgroundColor: surfaces.surface }]}
          >
            <MaterialCommunityIcons name="calendar" size={18} color={accent} />
            <Text style={styles.dateBtnText}>{formatDay(date)}</Text>
          </Pressable>

          {dayExpenses.length > 0 ? (
            <View style={styles.linkBlock}>
              <Text style={styles.fieldLabel}>Powiąż z wydatkiem z tego dnia</Text>
              <Pressable
                onPress={() => setLinkId(null)}
                style={[
                  styles.linkChip,
                  { borderColor: surfaces.border },
                  linkId === null && { borderColor: accent, backgroundColor: surfaces.surfaceStrong },
                ]}
              >
                <Text style={[styles.linkChipText, linkId === null && { color: accent }]}>Nowy wydatek</Text>
              </Pressable>
              {dayExpenses.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setLinkId(item.id)}
                  style={[
                    styles.linkChip,
                    { borderColor: surfaces.border },
                    linkId === item.id && { borderColor: accent, backgroundColor: surfaces.surfaceStrong },
                  ]}
                >
                  <Text
                    style={[styles.linkChipText, linkId === item.id && { color: accent }]}
                    numberOfLines={1}
                  >
                    {item.name || item.category} · {formatPln(item.amount)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {linkId === null ? (
            <>
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
                placeholder="np. Lidl"
                value={name}
                onChangeText={setName}
                style={styles.input}
                outlineColor="#d7c8d3"
                activeOutlineColor={accent}
              />
              <CategoryPicker type="expense" value={category} onChange={setCategory} />
            </>
          ) : null}

          <Button
            mode="contained"
            onPress={() => void save()}
            disabled={!canSave || saving}
            buttonColor={accent}
            textColor="#fff"
            style={styles.save}
          >
            Zapisz paragon
          </Button>
        </ScrollView>
        <DateTimePickerModal
          isVisible={dateOpen}
          mode="date"
          date={parsePickedDate(date)}
          onConfirm={(picked) => {
            setDate(toIsoDate(picked));
            setLinkId(null);
            setDateOpen(false);
          }}
          onCancel={() => setDateOpen(false)}
          confirmTextIOS="Wybierz"
          cancelTextIOS="Anuluj"
        />
      </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontFamily: "MontserratSemiBold",
    fontSize: 20,
    color: "#1f1220",
  },
  content: { padding: 16, paddingBottom: 40 },
  fieldLabel: {
    fontFamily: "MontserratSemiBold",
    fontSize: 13,
    color: "#6b5f6a",
    marginTop: 8,
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
    marginBottom: 8,
  },
  dateBtnText: {
    fontFamily: "PoppinsRegular",
    fontSize: 15,
    color: "#1f1220",
  },
  input: { backgroundColor: "#fff", marginBottom: 10 },
  linkBlock: { marginBottom: 8 },
  linkChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  linkChipText: {
    fontFamily: "PoppinsRegular",
    fontSize: 14,
    color: "#1f1220",
  },
  save: { borderRadius: 12, marginTop: 8 },
});

export default AddReceiptModal;
