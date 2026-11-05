import tinycolor from "tinycolor2";
import GoalPriorityPicker from "../../components/GoalPriorityPicker";
import GoalCategoryPicker, { goalCategoryIcon } from "../../components/GoalCategoryPicker";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, IconButton, Text, TextInput } from "react-native-paper";
import { FinanceDisclosure } from "../../components/FinanceDisclosure";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfile } from "../../contexts/ProfileContext";
import { useFinance } from "../../contexts/FinanceContext";
import { useAccent } from "../../contexts/ThemeContext";
import { dateAfterDays, daysBetween, goalLimitScenario, goalPlan } from "../../helpers/goalPlan";
import { formatPln, parseAmount } from "../../helpers/money";
import { parsePickedDate, toIsoDate } from "../../helpers/dates";

type Routes = { GoalDetails: { goalId: string } };
const dateLabel = (date: string | null) => date ? date.split("-").reverse().join(".") : "Brak prognozy";
export default function GoalDetailsScreen() {
  const { params } = useRoute<RouteProp<Routes, "GoalDetails">>();
  const navigation = useNavigation();
  const { profile, members, goals, updateGoal, canAdmin } = useProfile();
  const { entries } = useFinance();
  const { accent, surfaces } = useAccent();
  const planTint = tinycolor.mix(accent, "#ffffff", 94).toHexString();
  const appearance = { divider: surfaces.border };
  const insets = useSafeAreaInsets();
  const goal = goals.find(item => item.id === params.goalId);
  const [limitDraft, setLimitDraft] = useState<string | null>(null);
  const [cuts, setCuts] = useState<string[]>([]);
  const [panel, setPanel] = useState<"edit" | "simulation" | "advice" | null>(null);
  const [cadence, setCadence] = useState<"month" | "week" | "day">("month");
  const [titleDraft, setTitleDraft] = useState("");
  const [targetDraft, setTargetDraft] = useState("");
  const [priorityDraft, setPriorityDraft] = useState(2);
  const [categoryDraft, setCategoryDraft] = useState("Inne");
  const [deadlineDraft, setDeadlineDraft] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { navigation.setOptions({ headerTitle: "Plan celu" }); }, [goal?.title, navigation]);
  if (!goal) return <View style={styles.content}><Text style={styles.hint}>Ten cel jest niedostępny lub został usunięty.</Text></View>;
  const plan = goalPlan(goal, profile, members, entries, toIsoDate(new Date()), goals);
  const suggestion = goalLimitScenario(plan.limit, plan.averageDailySpent, plan.fundingNeeded, plan.limit, plan.overdue ? null : plan.requiredDaily);
  const candidate = limitDraft == null ? suggestion.suggestedLimit : parseAmount(limitDraft);
  const limitScenario = candidate == null ? null : goalLimitScenario(plan.limit, plan.averageDailySpent, plan.fundingNeeded, candidate, plan.overdue ? null : plan.requiredDaily);
  const extraDaily = plan.suggestions.filter(item => cuts.includes(item.category)).reduce((sum, item) => sum + item.dailyCut, 0);
  const scenarioDaily = (plan.dailySaving ?? 0) + extraDaily;
  const scenarioDays = scenarioDaily > 0 ? Math.ceil(plan.fundingNeeded / scenarioDaily) : null;
  const scenarioDate = plan.remaining === 0 ? toIsoDate(new Date()) : scenarioDays == null ? null : dateAfterDays(toIsoDate(new Date()), scenarioDays);
  const progress = goal.targetAmount > 0 ? Math.min(1, Math.max(0, plan.saved / goal.targetAmount)) : 1;
  const today = toIsoDate(new Date());
  const deadlineDays = goal.deadline ? daysBetween(today, goal.deadline) : null;
  const scale = cadence === "month" ? 30 : cadence === "week" ? 7 : 1;
  const cadenceLabel = cadence === "month" ? "miesięcznie" : cadence === "week" ? "tygodniowo" : "dziennie";
  const required = plan.requiredDaily == null ? null : Math.ceil(plan.requiredDaily * scale * 100) / 100;
  const pace = plan.dailySaving == null ? null : plan.dailySaving * scale;
  const onTrack = !plan.overdue && plan.requiredDaily != null && plan.dailySaving != null && plan.dailySaving >= plan.requiredDaily;
  const statusColor = plan.remaining === 0 || onTrack ? "#247249" : "#975130";
  const openEditor = () => { setTitleDraft(goal.title); setTargetDraft(String(goal.targetAmount).replace(".", ",")); setDraft(String(goal.savedAmount).replace(".", ",")); setCategoryDraft(goal.category ?? "Inne"); setPriorityDraft(goal.priority ?? 2); setDeadlineDraft(goal.deadline); setPanel("edit"); };
  const row = (icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"], label: string, value: string, color?: string) => <View key={label} style={[styles.planRow, { borderBottomColor: surfaces.border }]}><MaterialCommunityIcons name={icon} size={22} color={accent} /><Text style={styles.rowLabel}>{label}</Text><Text style={[styles.rowValue, color ? { color } : null]}>{value}</Text></View>;
  return <View style={styles.screen}>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 104 }]}>
      <View style={[styles.summary, { backgroundColor: surfaces.surface, borderColor: "rgba(255,255,255,0.85)" }]}>
        <View style={styles.summaryTop}>
          <View style={[styles.goalIcon, { backgroundColor: surfaces.surfaceStrong }]}><MaterialCommunityIcons name={goalCategoryIcon(goal.category)} size={43} color={accent} /></View>
          <View style={styles.summaryCopy}><Text style={styles.heroTitle}>{goal.title}</Text><Text style={styles.hint}>Cel oszczędnościowy</Text><Text style={styles.targetValue}>{formatPln(goal.targetAmount)}</Text></View>
          {canAdmin ? <IconButton icon="pencil-outline" iconColor={accent} containerColor={surfaces.surfaceStrong} size={21} accessibilityLabel="Edytuj cel" onPress={openEditor} /> : null}
        </View>
        <View style={styles.progressRow}><View style={[styles.progressTrack, { backgroundColor: surfaces.border }]} accessibilityRole="progressbar" accessibilityLabel="Szacowany postęp celu" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}><View style={[styles.progressFill, { backgroundColor: accent, width: `${progress * 100}%` }]} /></View><Text style={styles.percent}>{Math.round(progress * 100)}%</Text></View>
        <View style={styles.summaryFooter}><Text style={styles.footerValue}>Odłożone: <Text style={styles.bold}>{formatPln(plan.saved)}</Text></Text><Text style={styles.footerValue}>Pozostało: <Text style={styles.bold}>{formatPln(plan.remaining)}</Text></Text></View>
        <Text style={styles.small}>Postęp obejmuje szacunek z niewykorzystanych limitów.</Text>
      </View>
      <Text style={styles.sectionTitle}>Plan osiągnięcia celu</Text>
      <View style={[styles.queueNotice, { backgroundColor: planTint }]}><MaterialCommunityIcons name="sort-variant" size={21} color={accent} /><Text style={styles.queueText}>Priorytet: {goal.priority === 3 ? "wysoki" : goal.priority === 1 ? "niski" : "standardowy"}. {plan.aheadCount > 0 && plan.remaining > 0 ? `Przed tym celem: ${plan.aheadCount} · pozostało do sfinansowania ${formatPln(plan.aheadAmount)}. Prognoza uwzględnia tę kolejkę.` : "Ten cel nie czeka na sfinansowanie innych celów."}</Text></View>
      <View style={styles.cadences}>{(["month", "week", "day"] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: cadence === value }} onPress={() => setCadence(value)} style={[styles.cadence, { backgroundColor: cadence === value ? accent : planTint }]}><MaterialCommunityIcons name="calendar-outline" size={18} color={cadence === value ? "#fff" : accent} /><Text style={[styles.cadenceText, { color: cadence === value ? "#fff" : "#514452" }]}>{value === "month" ? "Miesięcznie" : value === "week" ? "Tygodniowo" : "Dziennie"}</Text></Pressable>)}</View>
      <View style={[styles.callout, { backgroundColor: planTint }]}><MaterialCommunityIcons name="bullseye-arrow" size={36} color={accent} /><Text style={styles.calloutText}>{plan.remaining === 0 ? "Według zapisanego postępu cel jest osiągnięty." : plan.overdue ? "Termin celu minął. Ustaw nową datę, aby przeliczyć plan." : required != null ? <>Odkładaj <Text style={styles.bold}>{formatPln(required)} {cadenceLabel}</Text>, aby osiągnąć cel do {dateLabel(goal.deadline)}.</> : <>Dodaj termin celu, aby wyliczyć wymaganą kwotę odkładania.</>}</Text></View>
      <View>
        {row("calendar-check-outline", "Wybrany termin", goal.deadline ? dateLabel(goal.deadline) : "Nie ustawiono")}
        {row("clock-outline", "Pozostały czas", deadlineDays == null ? "—" : deadlineDays < 0 ? "Termin minął" : deadlineDays === 0 ? "Dzisiaj" : deadlineDays + " dni")}
        {row("database-outline", plan.aheadCount > 0 ? "Wymagane dla kolejki" : "Wymagane odkładanie", plan.overdue || required == null ? "—" : formatPln(required) + " / " + (cadence === "month" ? "mies." : cadence === "week" ? "tydz." : "dzień"))}
        {row("chart-bar", "Tempo wspólnej puli", pace == null ? "Brak danych" : formatPln(pace) + " / " + (cadence === "month" ? "mies." : cadence === "week" ? "tydz." : "dzień"), onTrack ? "#247249" : undefined)}
      </View>
      <View style={[styles.status, { backgroundColor: plan.remaining === 0 || onTrack ? "#e0f2e4" : "#f7eadd" }]}><MaterialCommunityIcons name={plan.remaining === 0 || onTrack ? "rocket-launch-outline" : "information-outline"} size={29} color={statusColor} /><View style={styles.summaryCopy}><Text style={[styles.title, { color: statusColor }]}>{plan.remaining === 0 ? "Cel osiągnięty według szacunku" : onTrack ? "Tempo wystarcza do terminu" : plan.overdue ? "Plan wymaga nowego terminu" : plan.dailySaving == null ? "Potrzebujemy historii wydatków" : goal.deadline ? "Sprawdź plan oszczędzania" : "Ustal termin swojego celu"}</Text><Text style={styles.hint}>{plan.remaining === 0 ? "Sprawdź rzeczywisty stan odłożonych pieniędzy." : plan.estimatedDate ? "Przy obecnym tempie przewidywany termin to " + dateLabel(plan.estimatedDate) + "." : "Prognoza pojawi się, gdy zapisane wydatki pozwolą wyliczyć dodatnie tempo oszczędzania."}</Text></View></View>
      <FinanceDisclosure><Text style={styles.hint}>Odłożone ręcznie: {formatPln(goal.savedAmount)}. Szacunek z limitów: {formatPln(plan.autoSaved)}. To nie jest potwierdzony stan oszczędności. Szacowana nadwyżka jest dzielona raz, według priorytetu i kolejności dodania. Tempo wynika z zapisów z {plan.observedDays} dni od {dateLabel(plan.from)}; dni bez zapisów obniżają średnie wydatki. Miesiąc w przeliczeniu oznacza 30 dni, tydzień 7 dni. Prognoza zakłada podobne wydatki i nie gwarantuje dostępności pieniędzy.</Text></FinanceDisclosure>
      <View style={styles.bottomActions}><Button mode="outlined" icon={({ color }) => <MaterialCommunityIcons name="calculator-variant-outline" size={22} color={color} />} style={[styles.bottomButton, { borderColor: accent }]} textColor={accent} compact labelStyle={styles.bottomButtonLabel} contentStyle={styles.buttonContent} onPress={() => setPanel("simulation")}>Symulacja</Button><Button mode="contained" icon={({ color }) => <MaterialCommunityIcons name="lightbulb-outline" size={22} color={color} />} style={styles.bottomButton} buttonColor={accent} compact labelStyle={styles.bottomButtonLabel} contentStyle={styles.buttonContent} onPress={() => setPanel("advice")}>Porady</Button></View>
    </ScrollView>
    <Modal visible={panel != null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!saving) { setDateOpen(false); setPanel(null); } }}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.modalHeader}><Text style={styles.sectionTitle}>{panel === "edit" ? "Edytuj cel" : panel === "simulation" ? "Symulacja oszczędzania" : "Porady dla Twojego celu"}</Text><IconButton icon="close" iconColor={accent} accessibilityLabel="Zamknij" disabled={saving} onPress={() => { setDateOpen(false); setPanel(null); }} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 24 }]}>
          {panel === "edit" ? <View style={styles.group}>
            <TextInput mode="outlined" label="Nazwa celu" value={titleDraft} onChangeText={setTitleDraft} disabled={saving} />
            <GoalCategoryPicker value={categoryDraft} onChange={setCategoryDraft} />
            <GoalPriorityPicker value={priorityDraft} onChange={setPriorityDraft} />
            <TextInput mode="outlined" label="Kwota docelowa (zł)" value={targetDraft} onChangeText={setTargetDraft} keyboardType="decimal-pad" disabled={saving} />
            <TextInput mode="outlined" label="Ręcznie odłożone (zł)" value={draft} onChangeText={setDraft} keyboardType="decimal-pad" disabled={saving} />
            <Button mode="outlined" icon="calendar-outline" textColor={accent} disabled={saving} onPress={() => setDateOpen(true)}>{deadlineDraft ? dateLabel(deadlineDraft) : "Ustaw termin celu"}</Button>
            {deadlineDraft ? <Button disabled={saving} onPress={() => setDeadlineDraft(null)}>Usuń termin</Button> : null}
            <Button mode="contained" buttonColor={accent} loading={saving} disabled={saving || !titleDraft.trim() || parseAmount(targetDraft) == null || (parseAmount(targetDraft) ?? 0) <= 0 || parseAmount(draft) == null} onPress={async () => {
              const target = parseAmount(targetDraft), saved = parseAmount(draft); if (target == null || target <= 0 || saved == null || saving) return;
              setSaving(true); try { await updateGoal(goal.id, { title: titleDraft.trim(), category: categoryDraft, priority: priorityDraft, targetAmount: target, savedAmount: saved, deadline: deadlineDraft }); setPanel(null); } catch { Alert.alert("Nie zapisano celu", "Spróbuj ponownie."); } finally { setSaving(false); }
            }}>Zapisz zmiany</Button>
          </View> : null}
          {panel === "simulation" ? <>
    {plan.remaining > 0 ? <View style={[styles.card, { borderColor: appearance.divider }]}>
      <View style={styles.sectionHeading}><Text style={styles.title}>{profile?.accountType === "family" ? "Limit rodziny" : "Zmiana dziennego limitu"}</Text></View>
      <Text style={styles.hint}>Obecny limit: {formatPln(plan.limit)} / dzień.{plan.averageDailySpent != null ? " Średnie wydatki: " + formatPln(plan.averageDailySpent) + " / dzień." : " Brak historii — poniżej pokazujemy wyłącznie wariant budżetu."}</Text>
      <Text style={styles.hint}>{plan.requiredDaily != null && !plan.overdue ? "Aby odkładać wymaganą kwotę do terminu, na codzienne wydatki powinno zostawać najwyżej:" : "Sprawdź wariant wydawania o 20% mniej niż dotychczas:"}</Text>
      <Text style={[styles.value, { color: accent }]}>{formatPln(suggestion.suggestedLimit)} / dzień</Text>
      {suggestion.impossible ? <Text style={styles.hint}>Sam niższy limit nie wystarczy do terminu. Nawet przy zerowych wydatkach brakuje {formatPln(suggestion.shortfall)} dziennie. Rozważ późniejszy termin, tańszy cel lub dodatkowe środki.</Text> : null}
      <TextInput outlineStyle={styles.inputOutline} style={{ backgroundColor: surfaces.surface }} outlineColor={surfaces.border} activeOutlineColor={accent} mode="outlined" label={profile?.accountType === "family" ? "Sprawdź wspólny limit rodziny (zł/dzień)" : "Sprawdź inny limit (zł/dzień)"} keyboardType="decimal-pad" value={limitDraft ?? String(suggestion.suggestedLimit).replace(".", ",")} onChangeText={setLimitDraft} />
      {limitScenario ? <View style={[styles.scenario, { backgroundColor: planTint }]} accessibilityLiveRegion="polite">
        <Text style={styles.title}>Przy takim limicie</Text>
        <Text style={[styles.value, { color: accent }]}>{dateLabel(limitScenario.date)}</Text>
        <Text style={styles.hint}>Możliwe odkładanie: {formatPln(limitScenario.dailySaving)} dziennie.{limitScenario.days != null ? " Około " + limitScenario.days + " dni do celu." : " Ten wariant nie daje nadwyżki."}</Text>
        {limitScenario.meetsDeadline != null ? <Text style={styles.hint}>{limitScenario.meetsDeadline ? "Ten wariant pozwala zdążyć do terminu przy przyjętych założeniach." : "Ten wariant nie wystarczy do wybranego terminu."}</Text> : null}
      </View> : <Text style={styles.hint}>Wpisz poprawną kwotę limitu.</Text>}
      <FinanceDisclosure title="Założenia symulacji"><Text style={styles.hint}>Symulacja zachowuje obecny postęp i dotychczasowy budżet jako punkt odniesienia. Zakłada rzeczywiste ograniczenie wydatków do nowego limitu. Samo wpisanie niższego limitu nie odkłada pieniędzy. Scenariusze kategorii w poradach liczymy osobno.</Text></FinanceDisclosure>
      {canAdmin ? <Button style={[styles.button, { borderColor: accent }]} mode="outlined" textColor={accent} disabled={candidate == null} onPress={() => { setPanel(null); navigation.navigate({ name: "DailyBudget", params: { suggestedLimit: candidate } } as never); }}>{profile?.accountType === "family" ? "Przejdź do limitów rodziny" : "Przejdź do zmiany limitu"}</Button> : null}
    </View> : null}
            {plan.remaining === 0 ? <Text style={styles.hint}>Według zapisanego postępu cel został osiągnięty. Symulacja nie jest potrzebna.</Text> : null}
          </> : null}
          {panel === "advice" ? <>
    <View style={[styles.card, { borderColor: appearance.divider }]}>
      <View style={styles.sectionHeading}><Text style={styles.title}>Gdzie ograniczyć wydatki</Text></View>
      <Text style={styles.hint}>Wybierz kategorie, w których możesz ograniczyć wydatki o 20%. To symulacja — nie zmienia Twoich limitów ani zapisanych operacji.</Text>
      {plan.suggestions.length ? plan.suggestions.map(item => <Pressable key={item.category} accessibilityRole="checkbox" accessibilityState={{ checked: cuts.includes(item.category) }} accessibilityLabel={`${item.category}, oszczędność ${formatPln(item.dailyCut)} dziennie`} onPress={() => setCuts(current => current.includes(item.category) ? current.filter(value => value !== item.category) : [...current, item.category])} style={[styles.category, { borderColor: appearance.divider }]}>
        <MaterialCommunityIcons name={cuts.includes(item.category) ? "checkbox-marked" : "checkbox-blank-outline"} size={23} color={cuts.includes(item.category) ? accent : "#9a8a96"} />
        <View style={styles.categoryCopy}><Text style={styles.title}>{item.category}</Text><Text style={styles.hint}>−20% z {formatPln(item.amount)}</Text></View>
        <View style={styles.categoryAmount}><Text style={[styles.categoryValue, { color: accent }]}>+{formatPln(item.dailyCut)}</Text><Text style={styles.hint}>dziennie</Text></View>
      </Pressable>) : <Text style={styles.hint}>Brak wydatków w kategoriach do porównania. Sugestie pojawią się po zapisaniu codziennych zakupów.</Text>}
      {extraDaily > 0 ? <View style={[styles.scenario, { backgroundColor: planTint }]} accessibilityLiveRegion="polite">
        <Text style={styles.title}>Wynik wybranych zmian</Text>
        <Text style={[styles.value, { color: accent }]}>{dateLabel(scenarioDate)}</Text>
        <Text style={styles.hint}>Tempo: {formatPln(scenarioDaily)} dziennie.{plan.days != null && scenarioDays != null ? " Około " + Math.max(0, plan.days - scenarioDays) + " dni szybciej." : ""}</Text>
      </View> : null}
    </View>

            <Text style={styles.hint}>Jeśli ograniczenie wydatków nie wystarczy, rozważ późniejszy termin lub niższą kwotę celu. Wybrane warianty nie zmieniają automatycznie Twojego budżetu.</Text>
          </> : null}
        </ScrollView>
        <DateTimePickerModal isVisible={dateOpen} mode="date" date={deadlineDraft ? parsePickedDate(deadlineDraft) : new Date()} onConfirm={date => { setDeadlineDraft(toIsoDate(date)); setDateOpen(false); }} onCancel={() => setDateOpen(false)} confirmTextIOS="Wybierz" cancelTextIOS="Anuluj" locale="pl-PL" />
      </SafeAreaView>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  queueNotice: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 12, alignItems: "flex-start" },
  queueText: { flex: 1, fontFamily: "PoppinsRegular", fontSize: 11, lineHeight: 18, color: "#514452" },
  summary: { padding: 16, borderRadius: 22, borderWidth: 1, gap: 14, shadowColor: "#45243f", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 5, elevation: 2 },
  summaryTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  goalIcon: { width: 72, height: 72, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  summaryCopy: { flex: 1, gap: 6 },
  targetValue: { fontFamily: "MontserratSemiBold", fontSize: 25, color: "#21112d", fontVariant: ["tabular-nums"] },
  progressRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  percent: { fontFamily: "MontserratSemiBold", fontSize: 14, color: "#21112d" },
  summaryFooter: { flexDirection: "row", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  footerValue: { fontFamily: "PoppinsRegular", fontSize: 12, color: "#514452" },
  bold: { fontFamily: "MontserratSemiBold", color: "#21112d" },
  small: { fontFamily: "PoppinsRegular", fontSize: 10, lineHeight: 16, color: "#78677d" },
  sectionTitle: { fontFamily: "MontserratSemiBold", fontSize: 19, lineHeight: 26, color: "#21112d", flexShrink: 1 },
  cadences: { flexDirection: "row", gap: 7 },
  cadence: { flex: 1, paddingVertical: 13, paddingHorizontal: 5, borderRadius: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 5 },
  cadenceText: { fontFamily: "PoppinsRegular", fontSize: 11 },
  callout: { borderRadius: 17, padding: 16, flexDirection: "row", gap: 14, alignItems: "center" },
  calloutText: { fontFamily: "PoppinsRegular", fontSize: 14, lineHeight: 23, color: "#32213d", flex: 1 },
  planRow: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, paddingVertical: 14, flexWrap: "wrap" },
  rowLabel: { flex: 1, fontFamily: "PoppinsRegular", fontSize: 12, color: "#32213d", minWidth: 100 },
  rowValue: { fontFamily: "MontserratSemiBold", fontSize: 13, color: "#21112d", maxWidth: "60%", textAlign: "right" },
  status: { borderRadius: 18, padding: 18, flexDirection: "row", gap: 13, alignItems: "flex-start" },
  bottomActions: { flexDirection: "row", gap: 12, paddingTop: 8, flexWrap: "wrap" },
  bottomButton: { flex: 1, minWidth: 120, borderRadius: 12 },
  buttonContent: { paddingVertical: 1, minHeight: 42 },
  bottomButtonLabel: { fontSize: 12, marginVertical: 9, marginHorizontal: 10 },
  modalHeader: { paddingLeft: 20, paddingRight: 10, paddingTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  button: { borderRadius: 12 },
  inputOutline: { borderRadius: 12 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  screen: { flex: 1, backgroundColor: "#fff" },
  heroTitle: { fontFamily: "MontserratSemiBold", fontSize: 20, lineHeight: 27, color: "#1f1220" },
  progressTrack: { flex: 1, height: 10, borderRadius: 4, backgroundColor: "#eee8ed", overflow: "hidden", marginTop: 8 },
  progressFill: { height: "100%", borderRadius: 4 },
  content: { padding: 16, gap: 18, width: "100%", maxWidth: 640, alignSelf: "center" }, card: { borderTopWidth: 1, paddingTop: 24, paddingBottom: 4, gap: 16 },
  title: { fontFamily: "MontserratSemiBold", fontSize: 16, lineHeight: 24, color: "#1f1220", flexShrink: 1 },
  hero: { fontFamily: "MontserratSemiBold", fontSize: 40, lineHeight: 54, letterSpacing: -1.5, color: "#1f1220", fontVariant: ["tabular-nums"] },
  value: { fontFamily: "MontserratSemiBold", fontSize: 21, lineHeight: 30, color: "#1f1220" },
  hint: { fontFamily: "PoppinsRegular", fontSize: 13, lineHeight: 21, color: "#6b5f6a" },
  categoryCopy: { flex: 1, gap: 4 },
  categoryAmount: { alignItems: "flex-end", gap: 4 },
  categoryValue: { fontFamily: "MontserratSemiBold", fontSize: 16 },
  group: { gap: 14 }, category: { borderTopWidth: 1, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }, scenario: { borderRadius: 12, padding: 18, gap: 10 },
});
