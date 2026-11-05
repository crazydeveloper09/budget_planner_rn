import { useHeaderHeight } from "@react-navigation/elements";
import { useKeyboardVisible } from "../../helpers/useKeyboardVisible";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { useBudgetGuard } from "../../components/useBudgetGuard";
import React, { useCallback, useMemo, useState } from "react";
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
import { Receipt, Transaction, TransactionType } from "../../db/interfaces";
import { pickReceiptImage } from "../../helpers/receiptFiles";
import { parsePickedDate, toIsoDate } from "../../helpers/dates";
import { formatPln, parseAmount } from "../../helpers/money";
import CategoryPicker from "../../components/CategoryPicker";
import OwnerPicker from "../../components/OwnerPicker";
import ReceiptAttach from "../../components/ReceiptAttach";
import ReceiptPreviewModal from "../../components/ReceiptPreviewModal";
import EditEntryModal from "../../components/EditEntryModal";
import { useAccent } from "../../contexts/ThemeContext";
import { ownerLabel } from "../../helpers/owners";
import { remainingAfterDay } from "../../helpers/wallet";
import { totalExpenses, totalIncomings } from "./helpers/countSum";

const EXPENSE_COLOR = "#b42318";
const INCOME_COLOR = "#2D6A4F";

function formatDayHeading(date: Date, isToday: boolean) {
  const label = date.toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const titled = label.charAt(0).toUpperCase() + label.slice(1);
  return isToday ? `Dzisiaj · ${titled}` : titled;
}

type DayEntryRowProps = {
  item: Transaction;
  receipts: Receipt[];
  accent: string;
  surface: string;
  border: string;
  isFamily: boolean;
  members: ReturnType<typeof useProfile>["members"];
  onOpenReceipt: (receipt: Receipt) => void;
  onAddReceipt: (item: Transaction) => void;
  onEdit: (item: Transaction) => void;
  onRemove: (id: number) => void;
};

const DayEntryRow: React.FC<DayEntryRowProps> = ({
  item,
  receipts,
  accent,
  surface,
  border,
  isFamily,
  members,
  onOpenReceipt,
  onAddReceipt,
  onEdit,
  onRemove,
}) => {
  const itemReceipts = receipts.filter((receipt) => receipt.entryId === item.id);
  const firstReceipt = itemReceipts[0];
  const isExpense = item.type === "expense";
  const amountColor = isExpense ? EXPENSE_COLOR : INCOME_COLOR;
  const meta = [
    item.name ? item.category : null,
    isFamily ? ownerLabel(item.memberId, members) : null,
    itemReceipts.length > 1 ? `${itemReceipts.length} paragony` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={[styles.row, { backgroundColor: surface, borderColor: border }]}>
      {firstReceipt ? (
        <Pressable onPress={() => onOpenReceipt(firstReceipt)}>
          <Image source={{ uri: firstReceipt.uri }} style={styles.rowThumb} />
        </Pressable>
      ) : (
        <View style={[styles.rowIcon, { backgroundColor: isExpense ? "#fdecea" : "#e8f5ee" }]}>
          <MaterialCommunityIcons
            name={isExpense ? "arrow-bottom-left" : "arrow-top-right"}
            size={18}
            color={amountColor}
          />
        </View>
      )}
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.name || item.category}
        </Text>
        {meta ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.rowAmount, { color: amountColor }]}>
        {isExpense ? "−" : "+"}
        {formatPln(item.amount)}
      </Text>
      <Pressable onPress={() => onEdit(item)} hitSlop={8}>
        <MaterialCommunityIcons name="pencil-outline" size={22} color={accent} />
      </Pressable>
      {isExpense ? (
        <Pressable onPress={() => onAddReceipt(item)} hitSlop={8}>
          <MaterialCommunityIcons name="camera-plus-outline" size={22} color={accent} />
        </Pressable>
      ) : null}
      <Pressable onPress={() => onRemove(item.id)} hitSlop={8}>
        <MaterialCommunityIcons name="close-circle" size={22} color="#9a8a96" />
      </Pressable>
    </View>
  );
};

const ExpensesIndexScreen: React.FC = () => {
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const keyboardVisible = useKeyboardVisible();
  const { accent, surfaces } = useAccent();
  const { profile, members } = useProfile();
  const { confirmIfOverBudget, budgetGuardModal } = useBudgetGuard();
  const { entries, receipts, addEntry, updateEntry, removeEntry, addReceiptsToEntry, removeReceipt } = useFinance();
  const [selectedStartDate, setSelectedStartDate] = useState<Date>(new Date());
  const [formType, setFormType] = useState<TransactionType | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
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

  const expenses = useMemo(
    () => dayEntries.filter((entry) => entry.type === "expense"),
    [dayEntries]
  );
  const incomes = useMemo(
    () => dayEntries.filter((entry) => entry.type === "income"),
    [dayEntries]
  );
  const spent = totalExpenses(dayEntries);
  const incoming = totalIncomings(dayEntries);
  const isToday = selectedIso === toIsoDate(new Date());
  const leftover = remainingAfterDay(profile, entries, selectedIso);
  const leftoverLabel = isToday ? "Po dzisiejszym dniu zostanie" : "Po tym dniu zostanie";
  const markedDays = useMemo(() => {
    const days = new Set<string>();
    for (const entry of entries) {
      if (!entry.regular) days.add(entry.date);
    }
    return days;
  }, [entries]);
  const customDatesStyles = useCallback(
    (date: Date) => {
      if (!markedDays.has(toIsoDate(date))) return {};
      return { dotColor: accent };
    },
    [accent, markedDays]
  );

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
    const ok = await confirmIfOverBudget({
      title: name.trim() || category,
      category,
      date: selectedIso,
      onReschedule: (value) => setSelectedStartDate(parsePickedDate(value)),
      remaining: leftover,
      amount: parsed,
      isExpense: formType === "expense",
    });
    if (!ok) return;
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
      Alert.alert("Nie udało się zapisać", "Spróbuj zapisać jeszcze raz.");
    }
  };

  const selectFormType = (type: TransactionType) => {
    setFormType((current) => (current === type ? null : type));
    setCategory("");
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={headerHeight}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, keyboardVisible && { paddingBottom: 24 }]}
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
        customDatesStyles={customDatesStyles}
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
        <View style={styles.dayHeadingRow}><Text style={styles.dayHeading}>{formatDayHeading(selectedStartDate, isToday)}</Text><Pressable accessibilityRole="button" accessibilityLabel="Dzienny limit i oszczędności" onPress={() => navigation.dispatch(CommonActions.navigate({ name: "User", params: { screen: "DailyBudget" } }))} style={styles.dailyLink}><MaterialCommunityIcons name="piggy-bank-outline" size={25} color="#111" /></Pressable></View>

        <View style={styles.totals}>
          <View style={[styles.totalCard, { backgroundColor: "#fdecea", borderColor: "#f4c7c3" }]}>
            <Text style={styles.totalLabel}>Wydatki</Text>
            <Text style={[styles.totalValue, { color: EXPENSE_COLOR }]}>{formatPln(spent)}</Text>
          </View>
          <View style={[styles.totalCard, { backgroundColor: "#e8f5ee", borderColor: "#bfe0cc" }]}>
            <Text style={styles.totalLabel}>Wpływy</Text>
            <Text style={[styles.totalValue, { color: INCOME_COLOR }]}>{formatPln(incoming)}</Text>
          </View>
        </View>


        {leftover == null ? (
          <Text style={styles.summaryLine}>Stan konta ustawisz w Profilu</Text>
        ) : (
          <View style={[styles.totalCard, { flex: 0, backgroundColor: leftover < 0 ? "#fdecea" : surfaces.surface, borderColor: leftover < 0 ? "#f4c7c3" : surfaces.border }]}>
            <Text style={styles.totalLabel}>{leftoverLabel}</Text>
            <Text style={[styles.totalValue, { color: leftover < 0 ? EXPENSE_COLOR : accent }]}>{formatPln(leftover)}</Text>
          </View>
        )}

        {dayEntries.length === 0 ? (
          <Text style={styles.empty}>Brak wydatków i wpływów w tym dniu</Text>
        ) : (
          <>
            {expenses.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Wydatki</Text>
                  <Text style={[styles.sectionCount, { color: EXPENSE_COLOR }]}>
                    {expenses.length}
                  </Text>
                </View>
                <View style={styles.list}>
                  {expenses.map((item) => (
                    <DayEntryRow
                      key={item.id}
                      item={item}
                      receipts={receipts}
                      accent={accent}
                      surface={surfaces.surface}
                      border={surfaces.border}
                      isFamily={isFamily}
                      members={members}
                      onOpenReceipt={setOpenReceipt}
                      onAddReceipt={(entry) => {
                        void (async () => {
                          const uri = await pickReceiptImage();
                          if (uri) await addReceiptsToEntry(entry, [uri]);
                        })();
                      }}
                      onEdit={setEditing}
                      onRemove={removeEntry}
                    />
                  ))}
                </View>
              </View>
            ) : null}
            {incomes.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Wpływy</Text>
                  <Text style={[styles.sectionCount, { color: INCOME_COLOR }]}>
                    {incomes.length}
                  </Text>
                </View>
                <View style={styles.list}>
                  {incomes.map((item) => (
                    <DayEntryRow
                      key={item.id}
                      item={item}
                      receipts={receipts}
                      accent={accent}
                      surface={surfaces.surface}
                      border={surfaces.border}
                      isFamily={isFamily}
                      members={members}
                      onOpenReceipt={setOpenReceipt}
                      onAddReceipt={() => undefined}
                      onEdit={setEditing}
                      onRemove={removeEntry}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
    <EditEntryModal
      entry={editing}
      showOwnerPicker={isFamily}
      showDate
      onClose={() => setEditing(null)}
      onSave={async (input) => {
        if (!editing) return;
        await updateEntry(editing.id, input);
      }}
    />
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
    {budgetGuardModal}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  dayHeadingRow: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  dailyLink: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
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
  dayHeading: {
    flex: 1,
    fontFamily: "MontserratSemiBold",
    fontSize: 18,
    color: "#1f1220",
  },
  totals: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  totalCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  totalLabel: {
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    color: "#6b5f6a",
    marginBottom: 2,
  },
  totalValue: {
    fontFamily: "MontserratSemiBold",
    fontSize: 18,
  },
  summaryLine: {
    fontFamily: "PoppinsRegular",
    fontSize: 14,
    color: "#1f1220",
    marginBottom: 4,
  },
  summaryWarn: {
    color: EXPENSE_COLOR,
  },
  empty: {
    fontFamily: "PoppinsRegular",
    color: "#6b5f6a",
    marginTop: 16,
  },
  section: {
    marginTop: 18,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: "MontserratSemiBold",
    fontSize: 16,
    color: "#1f1220",
  },
  sectionCount: {
    fontFamily: "MontserratSemiBold",
    fontSize: 14,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
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
  rowAmount: {
    fontFamily: "MontserratSemiBold",
    fontSize: 14,
  },
});

export default ExpensesIndexScreen;
