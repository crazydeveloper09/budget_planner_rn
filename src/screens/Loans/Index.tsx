import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, IconButton, ProgressBar, Text, TextInput } from "react-native-paper";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFinance } from "../../contexts/FinanceContext";
import { useProfile } from "../../contexts/ProfileContext";
import { useAccent } from "../../contexts/ThemeContext";
import { newLoanId } from "../../db/loans";
import { Loan } from "../../db/loanTypes";
import { parsePickedDate, toIsoDate } from "../../helpers/dates";
import { assessLoanBudget, dueDate, estimatedApr, loanSchedule, remainingPrincipal, roundMoney, suggestInstallment } from "../../helpers/loans";
import { formatPln } from "../../helpers/money";
import { CategoryTiles } from "../../components/CategoryPicker";

type LoanRoutes = { Loans: undefined; NewLoan: undefined; EditLoan: { id: string }; LoanDetails: { id: string } };
type LoanNavigation = NativeStackNavigationProp<LoanRoutes>;
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
const FORM_CONTROL_RADIUS = 13;

const LOAN_CATEGORIES = [
  { label: "Dom i remont", icon: "home-outline" },
  { label: "Samochód", icon: "car-outline" },
  { label: "Meble i AGD", icon: "sofa-outline" },
  { label: "Elektronika", icon: "laptop" },
  { label: "Edukacja", icon: "school-outline" },
  { label: "Inne", icon: "tag-outline" },
] as const;

function loanIconName(loan: Loan): IconName {
  return LOAN_CATEGORIES.find((option) => option.label === loan.category)?.icon ??
    (loan.kind === "credit" ? "bank-outline" : "account-group-outline");
}

function LoanIcon({ name, filled = false }: { name: IconName; filled?: boolean }) {
  const { accent, surfaces } = useAccent();
  return <View style={[styles.iconTile, { backgroundColor: filled ? accent : surfaces.surfaceStrong }]}>
    <MaterialCommunityIcons name={name} size={28} color={filled ? "#fff" : accent} />
  </View>;
}

function Progress({ total, remaining }: { total: number; remaining: number }) {
  const { accent, surfaces } = useAccent();
  const progress = total ? Math.max(0, Math.min(1, 1 - remaining / total)) : 0;
  return <View style={styles.inline}>
    <View style={styles.grow}><ProgressBar color={accent} progress={progress} style={[styles.track, { backgroundColor: surfaces.border }]} /></View>
    <Text style={styles.cardTitle}>{Math.round(progress * 100)}%</Text>
  </View>;
}

function AmountSplit({ total, remaining }: { total: number; remaining: number }) {
  return <View style={styles.split}>
    <Text style={styles.label}>Spłacono: <Text style={styles.cardTitle}>{formatPln(total - remaining)}</Text></Text>
    <Text style={styles.label}>Pozostało: <Text style={styles.cardTitle}>{formatPln(remaining)}</Text></Text>
  </View>;
}

function LoanPage({ children, tabs = false }: { children: React.ReactNode; tabs?: boolean }) {
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
    <ScrollView style={styles.sheet} contentContainerStyle={[styles.content, tabs && styles.tabContent]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  </KeyboardAvoidingView>;
}

function numeric(value: string) {
  const clean = value.replace(/[\s\u00a0]/g, "").replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(clean) ? Number(clean) : NaN;
}

function dayLabel(date: string) {
  return parsePickedDate(date).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });
}

function Field({ label, value, onChange, text = false }: { label: string; value: string; onChange: (value: string) => void; text?: boolean }) {
  const { accent, surfaces } = useAccent();
  return <TextInput mode="outlined" label={label} value={value} onChangeText={onChange} keyboardType={text ? "default" : "decimal-pad"}
    outlineColor={surfaces.border} activeOutlineColor={accent} style={styles.field} outlineStyle={styles.fieldOutline} />;
}

function DateField({ label, date, onChange, maximumDate }: { label: string; date: string; onChange: (date: string) => void; maximumDate?: Date }) {
  const [open, setOpen] = useState(false);
  const { accent, surfaces } = useAccent();
  return (
    <>
      <Button mode="outlined" icon="calendar" textColor={accent} style={[styles.fieldOutline, { borderColor: surfaces.border }]} onPress={() => setOpen(true)}>
        {label} · {dayLabel(date)}
      </Button>
      <DateTimePickerModal mode="date" isVisible={open} date={parsePickedDate(date)} maximumDate={maximumDate}
        onCancel={() => setOpen(false)} onConfirm={(picked) => { setOpen(false); onChange(toIsoDate(picked)); }}
        confirmTextIOS="Wybierz" cancelTextIOS="Anuluj" />
    </>
  );
}

function LoanChoices({ value, onValueChange, buttons }: {
  value: string; onValueChange: (value: string) => void; buttons: { value: string; label: string }[];
}) {
  const { accent, surfaces } = useAccent();
  return <View style={styles.choiceRow}>
    {buttons.map((button) => {
      const checked = value === button.value;
      return <Pressable key={button.value} accessibilityRole="radio" accessibilityState={{ checked }}
        onPress={() => onValueChange(button.value)}
        style={[styles.radioChoice, { borderColor: checked ? accent : surfaces.border, backgroundColor: checked ? surfaces.surface : "#fff" }]}>
        <MaterialCommunityIcons name={checked ? "check-circle" : "checkbox-blank-circle-outline"} size={19} color={checked ? accent : "#8d7f91"} />
        <Text style={[styles.cardTitle, styles.grow, checked && { color: accent }]}>{button.label}</Text>
      </Pressable>;
    })}
  </View>;
}

function LoanForm({ onSave, existing }: { onSave?: (loan: Loan) => Promise<void>; existing?: Loan }) {
  const nameOnly = Boolean(existing && (existing.payments.length || existing.skipped.length));
  const calculator = !onSave;
  const { accent, surfaces } = useAccent();
  const { entries, loans } = useFinance();
  const { profile } = useProfile();
  const [kind, setKind] = useState<Loan["kind"]>(existing?.kind ?? "credit");
  const [repayment, setRepayment] = useState(existing?.kind === "private" && existing.installment === null ? "date" : "fixed");
  const [targetDate, setTargetDate] = useState(() => existing ? dueDate(existing.firstDue, existing.months - 1) : dueDate(toIsoDate(new Date()), 12));
  const [creditMode, setCreditMode] = useState(existing?.contractTotalOnly ? "contract" : "terms");
  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [principal, setPrincipal] = useState(existing?.principal?.toString() ?? "");
  const [months, setMonths] = useState(String(existing?.months ?? 60));
  const [annualRate, setAnnualRate] = useState(existing?.annualRate?.toString() ?? "");
  const [installment, setInstallment] = useState(existing?.installment?.toString() ?? "");
  const [financedFee, setFinancedFee] = useState(existing?.financedFee?.toString() ?? "");
  const [upfrontFee, setUpfrontFee] = useState(existing?.upfrontFee?.toString() ?? "");
  const [monthlyFee, setMonthlyFee] = useState(existing?.monthlyFee?.toString() ?? "");
  const [feesOpen, setFeesOpen] = useState(false);
  const [disbursedOn, setDisbursedOn] = useState(() => existing?.disbursedOn ?? toIsoDate(new Date()));
  const [firstDue, setFirstDue] = useState(() => existing?.firstDue ?? dueDate(toIsoDate(new Date()), 1));
  const [reserve, setReserve] = useState("500");
  const [targetInstallment, setTargetInstallment] = useState("");
  const [result, setResult] = useState<{ key: string; options: number[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const credit = kind === "credit";
  const contractTotalOnly = credit && creditMode === "contract";
  const hasCreditTerms = credit && !contractTotalOnly;
  const byDate = !calculator && !credit && repayment === "date";
  const [firstYear, firstMonth] = firstDue.split("-").map(Number);
  const [lastYear, lastMonth] = targetDate.split("-").map(Number);
  const monthsToTarget = (lastYear - firstYear) * 12 + lastMonth - firstMonth;
  const paymentsToTarget = monthsToTarget + (dueDate(firstDue, monthsToTarget) <= targetDate ? 1 : 0);
  const period = byDate ? paymentsToTarget : numeric(months);
  const amount = numeric(principal);
  const manual = !byDate && installment.trim() ? numeric(installment) : null;
  const rate = hasCreditTerms && annualRate.trim() ? numeric(annualRate) : 0;
  const fee = hasCreditTerms && financedFee.trim() ? numeric(financedFee) : 0;
  const upfront = hasCreditTerms && upfrontFee.trim() ? numeric(upfrontFee) : 0;
  const monthly = hasCreditTerms && monthlyFee.trim() ? numeric(monthlyFee) : 0;
  const valid = Number.isFinite(amount) && amount > 0 && amount <= 1e9 && Number.isInteger(period) && period >= 1 && period <= 600 &&
    Number.isFinite(rate) && rate <= 100 && Number.isFinite(fee) && fee <= 1e9 && Number.isFinite(upfront) && upfront < amount &&
    Number.isFinite(monthly) && monthly <= 1e7 &&
    (manual === null ? !contractTotalOnly && (credit || byDate) : Number.isFinite(manual) && manual > 0 && manual <= 1e9) &&
    firstDue > disbursedOn;
  const sameTermsMode = existing?.kind === kind && Boolean(existing.contractTotalOnly) === contractTotalOnly;
  const draft: Loan | null = valid ? {
    id: "", name: name.trim(), kind, contractTotalOnly, principal: amount, disbursedOn, firstDue, months: period, annualRate: rate, installment: manual,
    financedFee: fee, upfrontFee: upfront, monthlyFee: monthly, payments: [], skipped: [],
    rateChanges: sameTermsMode ? existing.rateChanges : {},
    installmentOverrides: sameTermsMode ? existing.installmentOverrides : {},
  } : null;
  const rows = draft ? loanSchedule(draft) : [];
  const payable = Boolean(draft && rows.length && roundMoney(rows.reduce((sum, row) => sum + row.principal, 0)) >= roundMoney(amount + fee));
  const apr = draft && payable && hasCreditTerms ? estimatedApr(draft, rows) : null;
  const total = rows.reduce((sum, row) => sum + row.amount, upfront);

  const resultKey = JSON.stringify([credit ? draft : [amount, firstDue, targetInstallment], reserve]);
  const visibleResult = result?.key === resultKey ? result : null;
  const buffer = numeric(reserve);
  const target = numeric(targetInstallment);
  const privatePayments = (payment: number) => Array.from({
    length: payment > 0 ? Math.min(12, Math.ceil(roundMoney(amount) * 100 / Math.round(payment * 100))) : 0,
  }, (_, index) => ({ date: dueDate(firstDue, index), amount: roundMoney(Math.min(payment, amount - index * payment)) }));
  const optionAssessments = visibleResult && !credit
    ? visibleResult.options.map((payment) => assessLoanBudget(profile, entries, loans, privatePayments(payment), buffer))
    : [];
  const assessedPayment = target || visibleResult?.options[1] || Math.ceil(amount * 100 / 12) / 100;
  const today = toIsoDate(new Date());
  const creditPayments = upfront > 0 && disbursedOn >= today && firstDue <= dueDate(today, 12)
    ? [...rows, { date: disbursedOn, amount: upfront }]
    : rows;
  const assessment = visibleResult && Number.isFinite(buffer)
    ? assessLoanBudget(profile, entries, loans, credit ? creditPayments : privatePayments(assessedPayment), buffer)
    : null;

  const calculate = () => {
    if (credit) {
      if (draft) setResult({ key: resultKey, options: [] });
      return;
    }
    const today = toIsoDate(new Date());
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9 || !Number.isFinite(buffer) || firstDue <= today ||
        (targetInstallment.trim() && (!Number.isFinite(target) || target <= 0))) {
      Alert.alert("Uzupełnij dane", "Podaj kwotę pożyczki, rezerwę i przyszły termin pierwszej raty.");
      return;
    }
    const maximum = suggestInstallment(profile, entries, loans, firstDue, buffer, true, today);
    if (maximum === null) {
      Alert.alert("Brak stanu konta", "Ustaw stan konta w profilu, aby obliczyć ratę.");
      return;
    }
    setResult({ key: resultKey, options: [
      Math.min(amount, Math.floor(Math.round(maximum * 100) * 3 / 5) / 100),
      Math.min(amount, maximum),
    ] });
  };

  const save = async () => {
    const value = nameOnly ? existing : payable ? draft : null;
    if (!onSave || !value || !name.trim() || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave({ ...value, category: category || undefined, name: name.trim(), id: existing?.id ?? newLoanId() });
    } catch (error) {
      Alert.alert("Nie udało się zapisać zobowiązania", error instanceof Error ? error.message : "Spróbuj ponownie.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const categoryPicker = <CategoryTiles label="Kategoria zobowiązania" categories={LOAN_CATEGORIES} value={category} onChange={setCategory} />;
  if (nameOnly) return <>
    <Field label="Nazwa zobowiązania" value={name} onChange={setName} text />
    {categoryPicker}
    <Text style={styles.label}>To zobowiązanie ma już rozliczone raty. Oprocentowanie i kwoty przyszłych rat kredytu zmienisz w harmonogramie.</Text>
    <Button mode="contained" buttonColor={accent} disabled={!name.trim() || saving} loading={saving} onPress={() => void save()}>Zapisz zmiany</Button>
  </>;

  return (
    <>
      <View style={styles.choiceRow}>
        {([
          ["credit", "percent-outline", "Kredyt", "z oprocentowaniem"],
          ["private", "account-group-outline", "Pożyczka / rata", "bez oprocentowania"],
        ] as const).map(([value, icon, title, subtitle]) => {
          const active = value === kind;
          return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: active }}
            style={[styles.kindChoice, { backgroundColor: active ? accent : surfaces.surface }]}
            onPress={() => { setKind(value); setInstallment(""); }}>
            <MaterialCommunityIcons name={icon} color={active ? "#fff" : accent} size={26} />
            <Text style={[styles.cardTitle, active && styles.white]}>{title}</Text>
            <Text style={[styles.label, active && styles.white]}>{subtitle}</Text>
          </Pressable>;
        })}
      </View>
      {credit ? <LoanChoices value={creditMode} onValueChange={(value) => {
        setCreditMode(value);
        setPrincipal("");
        setInstallment("");
      }} buttons={[{ value: "terms", label: "Warunki kredytu" }, { value: "contract", label: "Kwoty z umowy" }]} /> : null}
      {!calculator ? <>
        <Field label="Nazwa zobowiązania" value={name} onChange={setName} text />
        {categoryPicker}
      </> : null}
      <Field label={contractTotalOnly ? "Całkowita kwota pozostała do spłaty (zł)" : "Otrzymana kwota (zł)"} value={principal} onChange={setPrincipal} />
      {!calculator || credit ? <DateField label={contractTotalOnly ? "Data stanu zadłużenia" : "Wypłata środków"} date={disbursedOn} onChange={setDisbursedOn} /> : null}
      <DateField label="Pierwsza rata" date={firstDue} onChange={setFirstDue} />
      {!credit && !calculator ? <>
        <Text style={styles.cardTitle}>Sposób spłaty</Text>
        <LoanChoices value={repayment} onValueChange={setRepayment} buttons={[
          { value: "fixed", label: "Stała rata" }, { value: "date", label: "Do konkretnej daty" },
        ]} />
        {byDate ? <DateField label="Spłata do" date={targetDate} onChange={setTargetDate} /> : null}
      </> : null}
      {credit && !contractTotalOnly && !installment.trim() ? <Field label="Okres spłaty (miesiące)" value={months} onChange={setMonths} /> : null}
      {hasCreditTerms ? <Field label="Oprocentowanie nominalne (%)" value={annualRate} onChange={setAnnualRate} /> : null}
      {!byDate && (credit || !calculator) ? <Field label={!credit ? "Miesięczna rata (zł)" : contractTotalOnly ? "Rata z umowy (zł)" : "Rata z umowy (zł, opcjonalnie)"} value={installment} onChange={setInstallment} /> : null}
      {hasCreditTerms ? (
        <>
          <Button mode="text" icon={feesOpen ? "chevron-up" : "chevron-down"} textColor={accent} onPress={() => setFeesOpen(!feesOpen)}>Prowizje i ubezpieczenie</Button>
          {feesOpen ? <>
            <Field label="Prowizja doliczona do kapitału (zł)" value={financedFee} onChange={setFinancedFee} />
            <Field label="Koszty zapłacone przy wypłacie (zł)" value={upfrontFee} onChange={setUpfrontFee} />
            <Field label="Ubezpieczenie i opłaty miesięczne (zł)" value={monthlyFee} onChange={setMonthlyFee} />
          </> : null}
        </>
      ) : null}
      {calculator ? (
        <View style={[styles.card, { backgroundColor: surfaces.surface }]}>
          <Field label="Rezerwa bezpieczeństwa (zł)" value={reserve} onChange={setReserve} />
          {!credit ? <Field label="Rata do sprawdzenia (opcjonalnie)" value={targetInstallment} onChange={setTargetInstallment} /> : null}
        </View>
      ) : null}
      {calculator ? <Button mode="contained" icon="calculator" buttonColor={accent}
        style={styles.primaryButton} contentStyle={styles.primaryContent}
        disabled={!Number.isFinite(buffer) || (credit && !draft)} onPress={calculate}>Oblicz ratę</Button> : null}
      {calculator && !credit && visibleResult ? (
        <View style={styles.choiceRow}>
          {visibleResult.options.map((payment, index) => {
            const duration = payment > 0 ? Math.ceil(roundMoney(amount) * 100 / Math.round(payment * 100)) : 0;
            return <View key={index} style={[styles.resultCard, { backgroundColor: index === 0 ? surfaces.surface : surfaces.surfaceStrong }]}>
              <MaterialCommunityIcons name={index === 0 ? "shield-outline" : "timer-outline"} size={23} color={accent} />
              <Text style={styles.cardTitle}>{index === 0 ? "Większa rezerwa" : "Szybsza spłata"}</Text>
              <Text style={[styles.cardTitle, { color: accent }]}>{formatPln(payment)} / mies.</Text>
              <Text style={styles.label}>{duration > 0 ? `${duration} mies. · do ${dayLabel(dueDate(firstDue, duration - 1))}` : "Brak miejsca w budżecie na dodatkową ratę."}</Text>
              {optionAssessments[index] ? <Text style={styles.label}>{optionAssessments[index]!.gap > 0
                ? `Do rezerwy zabraknie ${formatPln(optionAssessments[index]!.gap)}`
                : "Mieści się w prognozie"}</Text> : null}
            </View>;
          })}
        </View>
      ) : null}
      {payable && (!calculator || (credit && visibleResult)) ? (
        <View style={[styles.hint, { backgroundColor: surfaces.surface }]}>
          <LoanIcon name="calendar-check-outline" />
          <View style={[styles.grow, styles.loanCopy]}>
            <Text style={[styles.cardTitle, { color: accent }]}>{credit ? "Pierwsza rata" : "Szacowany czas spłaty"}</Text>
            <Text style={[styles.title, { color: accent }]}>{credit ? formatPln(rows[0].amount) : `${rows.length} mies.`}</Text>
            <Text style={styles.label}>{credit ? `Łącznie ${formatPln(total)} · ${rows.length} rat` : `Miesięczna rata ${formatPln(rows[0].amount)}`}</Text>
            <Text style={styles.label}>Koniec spłaty {dayLabel(rows[rows.length - 1].date)}</Text>
            {hasCreditTerms ? <Text style={styles.label}>Szacunkowe RRSO {apr === null ? "—" : apr.toLocaleString("pl-PL", { maximumFractionDigits: 2 }) + "%"}</Text> : null}
          </View>
        </View>
      ) : draft && !payable && (!calculator || visibleResult) ? <Text style={styles.label}>Podana rata nie spłaca zobowiązania w ciągu 600 miesięcy.</Text> : null}
      {visibleResult && (!credit || payable) ? (
        <View style={[styles.card, { backgroundColor: surfaces.surface }]}>
          <Text style={styles.title}>{credit ? "Czy budżet udźwignie ratę?" : `Ocena raty ${formatPln(assessedPayment)}`}</Text>
          {!credit && !target && !visibleResult.options[1] ? <Text style={styles.label}>Rata przy spłacie pożyczki w 12 miesięcy.</Text> : null}
          {assessment ? <>
            <Text style={styles.cardTitle}>{assessment.gap > 0 ? "Rata przekracza możliwości budżetu w prognozie" : "Rata mieści się w prognozie budżetu"}</Text>
            <Text style={styles.label}>Najniższe saldo {formatPln(assessment.minimum)} · rezerwa {formatPln(buffer)}</Text>
            {assessment.firstShortfall ? <Text style={styles.label}>Pierwszy spadek poniżej rezerwy {dayLabel(assessment.firstShortfall)}. Największy niedobór {formatPln(assessment.gap)}.</Text> : null}
            {assessment.gap > 0 && assessment.suggestions.length > 0 ? <>
              <Text style={styles.cardTitle}>Gdzie sprawdzić wydatki</Text>
              {assessment.suggestions.map((item) => (
                <Text key={item.category} style={styles.label}>{item.category} · średnio {formatPln(item.amount)} / mies. · 20% mniej to {formatPln(item.reduction)} / mies.</Text>
              ))}
              <Text style={styles.label}>{assessment.gapWithCuts > 0
                ? `Po takiej redukcji w prognozie nadal zabraknie ${formatPln(assessment.gapWithCuts)} do rezerwy.`
                : "Przy takiej redukcji prognoza utrzymuje rezerwę."}</Text>
            </> : assessment.gap > 0 ? <Text style={styles.label}>W historii brakuje wydatków z kategorii, dla których można oszacować oszczędności.</Text> : null}
            <Text style={styles.label}>Prognoza do {dayLabel(assessment.horizon)}. {assessment.trackedMonths
              ? `Szacunek wydatków zmiennych na podstawie ${assessment.trackedMonths} mies. historii.`
              : "Brak historii wydatków zmiennych. Ocena opiera się na zapisanym planie."}</Text>
          </> : <Text style={styles.label}>{profile?.walletBalance == null
            ? "Ustaw stan konta w profilu, aby ocenić ratę."
            : "Pierwsza rata przypada poza 12-miesięczną prognozą."}</Text>}
        </View>
      ) : null}
      {!calculator ? <Button mode="contained" buttonColor={accent} style={styles.primaryButton} contentStyle={styles.primaryContent}
        disabled={!payable || !name.trim() || saving} loading={saving} onPress={() => void save()}>
        {existing ? "Zapisz zmiany" : "Dodaj zobowiązanie"}
      </Button> : null}
    </>
  );
}

type Dialog = "overpay" | "rate" | "pay" | "override";

function LoanDetails({ loan }: { loan: Loan }) {
  const navigation = useNavigation<LoanNavigation>();
  const [expanded, setExpanded] = useState<number | null>(null);
  const { accent, surfaces } = useAccent();
  const { changeLoan } = useFinance();
  const rows = useMemo(() => loanSchedule(loan), [loan]);
  const [limit, setLimit] = useState(6);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [value, setValue] = useState("");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const overpayKey = useRef("");
  const next = rows.find((row) => !row.payment && !row.skipped);
  const paymentRow = dialog === "pay" && next?.number === numeric(number) ? next : null;
  const remaining = remainingPrincipal(loan);
  const today = toIsoDate(new Date());
  const history = loan.payments.filter((payment) => payment.installment === null);
  const pendingRows = rows.filter((row) => !row.payment && !row.skipped);
  const projectedPrincipal = pendingRows.reduce((sum, row) => sum + row.principal, 0);
  const hasEndDate = roundMoney(projectedPrincipal) >= remaining;
  const mutate = async (action: Parameters<typeof changeLoan>[1]) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await changeLoan(loan.id, action);
      setDialog(null);
    } catch (error) {
      Alert.alert("Nie zapisano zmiany", error instanceof Error ? error.message : "Spróbuj ponownie.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const openDialog = (type: Dialog) => {
    setValue("");
    setNumber(next ? String(next.number) : "");
    setDate(today);
    if (type === "overpay") overpayKey.current = loan.id + ":extra:" + newLoanId();
    setDialog(type);
  };

  const undo = (key: string) => Alert.alert("Cofnąć spłatę?", "Powiązany wydatek zostanie wycofany, a pozostałe zadłużenie przeliczone.", [
    { text: "Anuluj", style: "cancel" },
    { text: "Cofnij spłatę", onPress: () => void mutate({ type: "undo", key }) },
  ]);
  const dialogTitle = dialog === "pay" ? "Zaksięguj ratę" : dialog === "overpay" ? "Dodaj nadpłatę" : dialog === "rate" ? "Zmień oprocentowanie" : "Wpisz ratę z umowy";

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loan.name,
      headerRight: () => <IconButton icon="pencil-outline" iconColor="#fff" accessibilityLabel="Edytuj zobowiązanie"
        style={styles.headerEdit}
        disabled={busy} onPress={() => navigation.navigate("EditLoan", { id: loan.id })} />,
    });
  }, [navigation, loan.id, loan.name, busy]);

  const total = loan.principal + loan.financedFee;
  const endDate = pendingRows[pendingRows.length - 1]?.date;
  return (
    <>
      <View style={[styles.card, { backgroundColor: surfaces.surface }]}>
        <View style={styles.inline}>
          <LoanIcon name={loanIconName(loan)} />
          <View style={styles.grow}>
            <Text style={styles.cardTitle}>{loan.name}</Text>
            <Text style={styles.total}>{formatPln(total)}</Text>
          </View>
          {loan.kind === "private" ? <Text style={styles.badge}>0% odsetek</Text> : null}
        </View>
        <Progress total={total} remaining={remaining} />
        <AmountSplit total={total} remaining={remaining} />
      </View>
      <View style={[styles.stats, { borderColor: surfaces.border }]}>
        {([
          ["calendar-check-outline", "Rata", next ? formatPln(next.amount) : "—"],
          ["database-outline", "Pozostało", String(pendingRows.length)],
          ["calendar-end-outline", "Koniec spłaty", endDate && hasEndDate ? parsePickedDate(endDate).toLocaleDateString("pl-PL", { month: "short", year: "numeric" }) : "—"],
        ] as const).map(([icon, label, value]) => <View key={label} style={styles.stat}>
          <MaterialCommunityIcons name={icon} size={24} color={accent} />
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.cardTitle}>{value}</Text>
        </View>)}
      </View>
      <Text style={styles.title}>Harmonogram spłaty</Text>
      <View style={styles.schedule}>
        {rows.slice(0, limit).map((row) => {
          const active = row.number === next?.number;
          const open = expanded === row.number;
          return <View key={row.number} style={[styles.scheduleCard, {
            backgroundColor: row.payment ? "#e8f5ee" : active ? surfaces.surface : "#fff",
            borderColor: active ? accent : surfaces.surface,
          }]}>
            <View style={styles.scheduleRow}>
              {row.skipped ? <View style={styles.paymentCheck}>
                <MaterialCommunityIcons name="calendar-remove-outline" size={22} color={accent} />
              </View> : <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={row.payment ? `Cofnij spłatę raty ${row.number}` : `Oznacz ratę ${row.number} jako zapłaconą`}
                accessibilityState={{ checked: Boolean(row.payment), disabled: busy || (!row.payment && !active) }}
                disabled={busy || (!row.payment && !active)}
                style={styles.paymentCheck}
                onPress={() => {
                  if (row.payment) undo(row.payment.key);
                  else void mutate({ type: "pay", number: row.number, date: today });
                }}
              >
                <MaterialCommunityIcons name={row.payment ? "check-circle" : "checkbox-blank-outline"}
                  size={22} color={row.payment ? "#247249" : active ? accent : "#9a8c9e"} />
              </Pressable>}
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
                onPress={() => setExpanded(open ? null : row.number)} style={styles.scheduleCopy}>
                <Text style={[styles.cardTitle, styles.grow]}>Rata {row.number}</Text>
                <Text style={[styles.label, styles.grow]}>{dayLabel(row.date)}</Text>
                <Text style={styles.cardTitle}>{formatPln(row.amount)}</Text>
              </Pressable>
            </View>
            {open ? <View style={styles.scheduleDetails}>
              {row.payment ? <Text style={styles.label}>Zapłacona {dayLabel(row.payment.date)}</Text> : null}
              {row.skipped ? <Text style={styles.label}>Pominięta</Text> : null}
              {loan.kind === "credit" && !loan.contractTotalOnly ? <Text style={styles.label}>Kapitał {formatPln(row.principal)} · odsetki {formatPln(row.interest)} · opłaty {formatPln(row.fees)}</Text> : null}
              {row.payment ? <Button compact textColor={accent} disabled={busy} onPress={() => undo(row.payment!.key)}>Cofnij spłatę</Button>
                : row.skipped ? <Button compact textColor={accent} disabled={busy} onPress={() => void mutate({ type: "unskip", number: row.number })}>Cofnij pominięcie</Button>
                : active ? <View style={styles.inline}>
                  <Button compact textColor={accent} disabled={busy} onPress={() => openDialog("pay")}>Zaksięguj ratę</Button>
                  {row.date <= today ? <Button compact textColor={accent} disabled={busy} onPress={() => void mutate({ type: "skip", number: row.number, date: today })}>Pomiń</Button> : null}
                </View> : null}
            </View> : null}
          </View>;
        })}
      </View>
      {rows.length > limit ? <Button textColor={accent} onPress={() => setLimit(limit + 24)}>Pokaż więcej rat ({rows.length - limit})</Button> : null}
      {next ? <>
        <View style={[styles.hint, { backgroundColor: surfaces.surface }]}>
          <MaterialCommunityIcons name="sync" color={accent} size={24} />
          <Text style={[styles.label, styles.grow]}>Po oznaczeniu raty jako zapłaconej wydatek automatycznie trafi do budżetu.</Text>
        </View>
        <View style={[styles.hint, { backgroundColor: surfaces.surface }]}>
          <MaterialCommunityIcons name="bell-outline" color={accent} size={24} />
          <Text style={[styles.label, styles.grow]}>Przypomnienia o ratach: 7, 3 i 1 dzień przed terminem.</Text>
        </View>
      </> : null}
      {remaining > 0 ? <Button mode="outlined" icon="plus-circle-outline" textColor={accent} disabled={busy} onPress={() => openDialog("overpay")}>Dodaj nadpłatę</Button> : null}
      {next && loan.kind === "credit" ? <View style={styles.heading}>
        {!loan.contractTotalOnly ? <Button textColor={accent} disabled={busy} onPress={() => openDialog("rate")}>Zmień oprocentowanie</Button> : null}
        <Button textColor={accent} disabled={busy} onPress={() => openDialog("override")}>Rata z umowy</Button>
      </View> : null}
      {history.length ? <Text style={styles.title}>Nadpłaty</Text> : null}
      {history.map((payment) => (
        <View key={payment.key} style={[styles.card, { backgroundColor: surfaces.surface }]}>
          <Text style={styles.cardTitle}>{formatPln(payment.amount)} · {dayLabel(payment.date)}</Text>
          <Button compact textColor={accent} disabled={busy} onPress={() => undo(payment.key)}>Cofnij nadpłatę</Button>
        </View>
      ))}
      {dialog ? <Modal visible transparent animationType="fade" onRequestClose={() => { if (!busy) setDialog(null); }}>
        <SafeAreaView style={styles.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.dialogCenter}>
            <View accessibilityViewIsModal style={styles.dialog}>
              <View style={styles.heading}>
                <Text style={[styles.title, styles.grow]}>{dialogTitle}</Text>
                <IconButton icon="close" accessibilityLabel="Zamknij" disabled={busy} onPress={() => setDialog(null)} />
              </View>
              {dialog === "pay" ? <Text style={styles.label}>{paymentRow
                ? `Rata ${paymentRow.number} · ${formatPln(paymentRow.amount)}`
                : "Harmonogram się zmienił. Zamknij okno i wybierz aktualną ratę."}</Text> : null}
              {dialog !== "pay" ? <Field label={dialog === "rate" ? "Oprocentowanie (%)" : "Kwota (zł)"} value={value} onChange={setValue} /> : null}
              {dialog === "rate" || dialog === "override" ? <Field label="Numer raty" value={number} onChange={setNumber} /> : (
                <DateField label="Data płatności" date={date} onChange={setDate} maximumDate={parsePickedDate(today)} />
              )}
              <Button mode="contained" buttonColor={accent} disabled={busy || (dialog === "pay" && !paymentRow)} loading={busy} onPress={() => {
                if (dialog === "pay" && paymentRow) void mutate({ type: "pay", number: paymentRow.number, date });
                else if (dialog === "overpay") void mutate({ type: "overpay", amount: numeric(value), date, key: overpayKey.current });
                else if (dialog === "rate") void mutate({ type: "rate", number: numeric(number), rate: numeric(value) });
                else if (dialog === "override") void mutate({ type: "override", number: numeric(number), amount: numeric(value) });
              }}>Zapisz</Button>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal> : null}
    </>
  );
}

export function NewLoanScreen() {
  const navigation = useNavigation<LoanNavigation>();
  const { createLoan } = useFinance();
  return <LoanPage><LoanForm onSave={async (loan) => {
    await createLoan(loan);
    navigation.replace("LoanDetails", { id: loan.id });
  }} /></LoanPage>;
}

export function EditLoanScreen() {
  const navigation = useNavigation<LoanNavigation>();
  const { params } = useRoute<RouteProp<LoanRoutes, "EditLoan">>();
  const { loans, changeLoan } = useFinance();
  const loan = loans.find((item) => item.id === params.id);
  return <LoanPage>{loan ? <LoanForm key={loan.id} existing={loan} onSave={async (value) => {
    const { id, name, category, rateChanges, installmentOverrides, payments, skipped, ...terms } = value;
    await changeLoan(id, { type: "edit", name, category, terms: payments.length || skipped.length ? undefined : terms });
    navigation.goBack();
  }} /> : <Text style={styles.label}>Zobowiązanie jest niedostępne.</Text>}</LoanPage>;
}

export function LoanDetailsScreen() {
  const { params } = useRoute<RouteProp<LoanRoutes, "LoanDetails">>();
  const { loans } = useFinance();
  const loan = loans.find((item) => item.id === params.id);
  return <LoanPage>{loan ? <LoanDetails key={loan.id} loan={loan} /> : <Text style={styles.label}>Zobowiązanie jest niedostępne.</Text>}</LoanPage>;
}

export default function LoansScreen() {
  const navigation = useNavigation<LoanNavigation>();
  const { accent, surfaces } = useAccent();
  const { loans } = useFinance();
  const [tab, setTab] = useState("list");
  const total = loans.reduce((sum, item) => sum + item.principal + item.financedFee, 0);
  const remaining = loans.reduce((sum, item) => sum + remainingPrincipal(item), 0);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <IconButton icon="plus" iconColor="#fff" accessibilityLabel="Dodaj zobowiązanie" onPress={() => navigation.navigate("NewLoan")} />,
    });
  }, [navigation]);

  return <LoanPage tabs>
    <View style={[styles.tabs, { backgroundColor: surfaces.surface }]}>
      {([["list", "format-list-bulleted", "Moje zobowiązania"], ["calculator", "calculator", "Kalkulator"]] as const).map(([key, icon, label]) => (
        <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}
          onPress={() => setTab(key)} style={[styles.tab, tab === key && { backgroundColor: accent }]}>
          <MaterialCommunityIcons name={icon} size={20} color={tab === key ? "#fff" : accent} />
          <Text style={[styles.tabLabel, tab === key && styles.white]}>{label}</Text>
        </Pressable>
      ))}
    </View>
    {tab === "calculator" ? <LoanForm /> : <>
      <View style={[styles.card, { backgroundColor: surfaces.surface }]}>
        <View style={styles.inline}>
          <LoanIcon name="database-outline" filled />
          <View style={styles.grow}>
            <Text style={styles.cardTitle}>Łączne zobowiązania</Text>
            <Text style={styles.total}>{formatPln(total)}</Text>
          </View>
        </View>
        <Progress total={total} remaining={remaining} />
        <AmountSplit total={total} remaining={remaining} />
      </View>
      {loans.length ? <View style={styles.loanList}>{loans.map((loan) => {
        const balance = remainingPrincipal(loan);
        const next = loanSchedule(loan).find((row) => !row.payment && !row.skipped);
        return <Pressable key={loan.id} accessibilityRole="button" onPress={() => navigation.navigate("LoanDetails", { id: loan.id })}
          style={[styles.card, styles.inline]}>
          <LoanIcon name={loanIconName(loan)} />
          <View style={[styles.grow, styles.loanCopy]}>
            <Text style={styles.loanTitle}>{loan.name}</Text>
            <Text style={styles.label}>{next ? `Rata: ${formatPln(next.amount)} · ` : ""}Pozostało: {formatPln(balance)}</Text>
            <Progress total={loan.principal + loan.financedFee} remaining={balance} />
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={accent} />
        </Pressable>;
      })}</View> : <Button mode="contained" buttonColor={accent} icon="plus" onPress={() => navigation.navigate("NewLoan")}>Dodaj pierwsze zobowiązanie</Button>}
    </>}
  </LoanPage>;
}

const styles = StyleSheet.create({
  headerEdit: { margin: 0, marginRight: -8 },
  screen: { flex: 1 },
  sheet: { flex: 1, backgroundColor: "#fcfaff" },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 120, gap: 20 },
  tabContent: { paddingBottom: 135 },
  card: { backgroundColor: "#fff", padding: 16, borderRadius: 16, gap: 12, elevation: 2, shadowColor: "#37243d", shadowOpacity: 0.09, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  tabs: { flexDirection: "row", borderRadius: 13, padding: 3, gap: 3 },
  tab: { flex: 1, minHeight: 42, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  tabLabel: { fontFamily: "MontserratSemiBold", fontSize: 11, color: "#43334a" },
  choiceRow: { flexDirection: "row", gap: 12 },
  radioChoice: { flex: 1, flexDirection: "row", alignItems: "center", minHeight: 48, gap: 7, padding: 8, borderRadius: 12, borderWidth: 1 },
  resultCard: { flex: 1, borderRadius: 14, padding: 12, gap: 6 },
  kindChoice: { flex: 1, borderRadius: 13, alignItems: "center", padding: 10, gap: 3 },
  white: { color: "#fff" },
  inline: { flexDirection: "row", alignItems: "center", gap: 8 },
  split: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
  iconTile: { width: 53, height: 53, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  track: { height: 9, borderRadius: 8 },
  loanList: { gap: 12 },
  loanCopy: { gap: 3 },
  loanTitle: { fontFamily: "MontserratSemiBold", fontSize: 15, color: "#1f1220" },
  badge: { color: "#205635", backgroundColor: "#dff5e5", borderRadius: 8, padding: 5, fontSize: 10 },
  stats: { flexDirection: "row", borderBottomWidth: 1, paddingBottom: 12 },
  stat: { flex: 1, alignItems: "center", gap: 3 },
  schedule: { gap: 8 },
  scheduleCard: { borderRadius: 11, borderWidth: 1, overflow: "hidden" },
  scheduleRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  paymentCheck: { width: 44, minHeight: 48, alignItems: "center", justifyContent: "center" },
  scheduleCopy: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 },
  scheduleDetails: { paddingHorizontal: 10, paddingBottom: 6 },
  hint: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 12 },
  primaryButton: { borderRadius: FORM_CONTROL_RADIUS, marginTop: 8 },
  fieldOutline: { borderRadius: FORM_CONTROL_RADIUS },
  primaryContent: { minHeight: 48 },
  heading: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  grow: { flex: 1 },
  title: { fontFamily: "MontserratSemiBold", fontSize: 20, color: "#1f1220" },
  total: { fontFamily: "MontserratSemiBold", fontSize: 28 },
  label: { fontFamily: "PoppinsRegular", fontSize: 13, color: "#5c5160" },
  cardTitle: { fontFamily: "MontserratSemiBold", fontSize: 14, color: "#1f1220" },
  field: { backgroundColor: "#fff" },
  overlay: { flex: 1, backgroundColor: "rgba(26,12,31,0.58)" },
  dialogCenter: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  dialog: { width: "100%", maxWidth: 480, borderRadius: 26, padding: 16, gap: 12, backgroundColor: "#fff" },
});
