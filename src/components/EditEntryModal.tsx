import { useBudgetGuard } from "./useBudgetGuard";
import React, { useEffect, useState } from "react";
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
import { useProfile } from "../contexts/ProfileContext";
import { useFinance } from "../contexts/FinanceContext";
import { useAccent } from "../contexts/ThemeContext";
import { NewTransaction, Transaction } from "../db/interfaces";
import { parsePickedDate, toIsoDate } from "../helpers/dates";
import { parseAmount } from "../helpers/money";
import { remainingAfterDay } from "../helpers/wallet";
import CategoryPicker from "./CategoryPicker";
import OwnerPicker from "./OwnerPicker";

type EditEntryModalProps = {
  entry: Transaction | null;
  showOwnerPicker?: boolean;
  showDate?: boolean;
  onClose: () => void;
  onSave: (input: NewTransaction) => Promise<void>;
};

function formatDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const EditEntryModal: React.FC<EditEntryModalProps> = ({
  entry,
  showOwnerPicker = false,
  showDate = false,
  onClose,
  onSave,
}) => {
  const { accent } = useAccent();
  const { confirmIfOverBudget, budgetGuardModal } = useBudgetGuard();
  const { profile, members } = useProfile();
  const { entries } = useFinance();
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [dateOpen, setDateOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [memberId, setMemberId] = useState<number | null>(null);
  const [day, setDay] = useState("10");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setDate(entry.date);
    setDay(entry.date.startsWith("2000-01-") ? String(Number(entry.date.slice(8, 10))) : "10");
    setName(entry.name);
    setCategory(entry.category);
    setAmount(String(entry.amount).replace(".", ","));
    setMemberId(entry.memberId);
    setDateOpen(false);
  }, [entry]);

  const leftover = remainingAfterDay(profile, entries, date);
  const extra = entry && entry.type === "expense" && entry.date === date ? entry.amount : 0;
  const validDay = /^\d{1,2}$/.test(day) && Number(day) >= 1 && Number(day) <= 31;
  const canSave = (!entry?.regular || validDay) && Boolean(category) && parseAmount(amount) !== null;
  const type = entry?.type ?? "expense";
  const title =
    type === "expense"
      ? entry?.regular
        ? "Edytuj stały wydatek"
        : "Edytuj wydatek"
      : entry?.regular
        ? "Edytuj stały wpływ"
        : "Edytuj wpływ";

  const save = async () => {
    const parsed = parseAmount(amount);
    if (!entry || !canSave || parsed === null) return;
    const ok = await confirmIfOverBudget({
      title: name.trim() || category,
      category,
      date,
      excludeEntryId: entry.id,
      onReschedule: setDate,
      remaining: leftover == null ? null : leftover + extra,
      amount: parsed,
      isExpense: type === "expense" && !entry.regular,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await onSave({
        date: entry.regular ? `2000-01-${day.padStart(2, "0")}` : date,
        type: entry.type,
        name: name.trim(),
        category,
        amount: parsed,
        regular: entry.regular,
        memberId,
      });
      onClose();
    } catch (error) {
      console.error(error);
      Alert.alert("Nie udało się zapisać", "Spróbuj ponownie.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={Boolean(entry)} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={22} color="#6b5f6a" />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {showDate ? (
              <Pressable style={[styles.dateBtn, { borderColor: "#d7c8d3" }]} onPress={() => setDateOpen(true)}>
                <MaterialCommunityIcons name="calendar" size={20} color={accent} />
                <Text style={styles.dateBtnText}>{formatDay(date)}</Text>
              </Pressable>
            ) : null}

            {showOwnerPicker ? (
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
              placeholder={type === "expense" ? "np. Lidl" : "np. Pensja"}
              value={name}
              onChangeText={setName}
              style={styles.input}
              outlineColor="#d7c8d3"
              activeOutlineColor={accent}
            />
            {entry?.regular ? <TextInput mode="outlined" label={type === "income" ? "Dzień wpływu w miesiącu (1–31)" : "Termin płatności (dzień miesiąca, 1–31)"} value={day} onChangeText={setDay} keyboardType="number-pad" maxLength={2} style={styles.input} /> : null}
            <CategoryPicker recurring={entry?.regular} type={type} value={category} onChange={setCategory} />
            <Button
              mode="contained"
              onPress={() => void save()}
              disabled={!canSave || saving}
              buttonColor={accent}
              textColor="#fff"
              style={styles.save}
            >
              Zapisz zmiany
            </Button>
          </ScrollView>
          <DateTimePickerModal
            isVisible={dateOpen}
            mode="date"
            date={parsePickedDate(date)}
            onConfirm={(picked) => {
              setDate(toIsoDate(picked));
              setDateOpen(false);
            }}
            onCancel={() => setDateOpen(false)}
            confirmTextIOS="Wybierz"
            cancelTextIOS="Anuluj"
          />
        {budgetGuardModal}
    </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
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
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  dateBtnText: {
    fontFamily: "PoppinsRegular",
    fontSize: 15,
    color: "#1f1220",
  },
  input: { backgroundColor: "#fff", marginBottom: 10 },
  save: { borderRadius: 12, marginTop: 8 },
});

export default EditEntryModal;
