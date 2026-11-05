import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import tinycolor from "tinycolor2";
import { toIsoDate } from "../../helpers/dates";
import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { RouteProp, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useProfile } from "../../contexts/ProfileContext";
import { useFinance } from "../../contexts/FinanceContext";
import { useAccent } from "../../contexts/ThemeContext";
import { dailyLimitAmount } from "../../helpers/dailyLeftover";
import { assessDailyGoal, recurringDate, spendingPlan } from "../../helpers/spendingPlan";
import { formatPln, parseAmount } from "../../helpers/money";

export default function DailyBudgetScreen() {
  const route = useRoute<RouteProp<{ DailyBudget: { suggestedLimit?: number } | undefined }, "DailyBudget">>();
  const suggestedLimit = route.params?.suggestedLimit;
  const { profile, members, canAdmin, setDailySaldo, setMemberDailySaldo } = useProfile();
  const { entries } = useFinance();
  const { accent, surfaces } = useAccent();
  const { width } = useWindowDimensions();
  const ringSize = Math.min(326, Math.max(210, width - 48));
  const lightAccent = tinycolor(accent).brighten(20).saturate(16).toHexString();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<"month" | "next">("month");
  const [familyLimitsOpen, setFamilyLimitsOpen] = useState(suggestedLimit != null);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [editing, setEditing] = useState(suggestedLimit != null && profile?.accountType === "personal");
  const [draft, setDraft] = useState(suggestedLimit == null ? "" : String(suggestedLimit).replace(".", ","));
  const [saving, setSaving] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const isFamily = profile?.accountType === "family";
  const draftAmount = parseAmount(draft);
  const familyGoal = editingMemberId == null ? dailyLimitAmount(profile, members) : draftAmount == null ? null : dailyLimitAmount(profile, members.map(member => member.id === editingMemberId ? { ...member, dailySaldo: draftAmount } : member));
  const goal = isFamily ? familyGoal : editing ? draftAmount : dailyLimitAmount(profile, members);
  const plan = spendingPlan(profile, entries);
  const selected = period === "month" ? plan?.month : plan?.next;
  const assessment = selected && goal != null && plan ? assessDailyGoal(selected, goal, plan.spentToday) : null;
  const now = new Date();
  const today = toIsoDate(now);
  const monthPrefix = today.slice(0, 7);
  const everydayExpenses = entries.filter(e => !e.regular && e.type === "expense" && !entries.some(template => template.regular && template.type === "expense" && template.name === e.name && template.category === e.category && template.amount === e.amount && template.memberId === e.memberId && toIsoDate(recurringDate(template, new Date(Number(e.date.slice(0, 4)), Number(e.date.slice(5, 7)) - 1, 1))) === e.date));
  const spentToday = everydayExpenses.filter(e => e.date === today).reduce((sum, e) => sum + e.amount, 0);
  const todayLeft = goal == null ? null : goal - spentToday;
  const ratio = goal != null && goal > 0 ? Math.min(1, spentToday / goal) : spentToday > 0 ? 1 : 0;
  const monthSpent = everydayExpenses.filter(e => e.date.startsWith(monthPrefix) && e.date <= today).reduce((sum, e) => sum + e.amount, 0);
  const monthBudget = goal == null ? null : goal * new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthRatio = monthBudget != null && monthBudget > 0 ? monthSpent / monthBudget : monthSpent > 0 ? 1 : 0;
  const negative = todayLeft != null && todayLeft < 0;
  const status = negative ? "#a33343" : "#247249";
  const editLimit = () => {
    if (isFamily) setFamilyLimitsOpen(open => !open);
    else if (canAdmin && profile?.accountType === "personal") { setDraft(String(dailyLimitAmount(profile, members)).replace(".", ",")); setEditing(open => !open); }
  };
  const save = async () => {
    const amount = parseAmount(draft);
    if (amount == null || saving) return;
    setSaving(true);
    try {
      await setDailySaldo(amount);
      setEditing(false);
    } catch { Alert.alert("Nie zapisano celu", "Spróbuj ponownie."); }
    finally { setSaving(false); }
  };

  const saveMemberLimit = async () => {
    if (editingMemberId == null || draftAmount == null || saving || !canAdmin) return;
    setSaving(true);
    try {
      await setMemberDailySaldo(editingMemberId, draftAmount);
      setEditingMemberId(null);
      setDraft("");
    } catch { Alert.alert("Nie zapisano limitu", "Spróbuj ponownie."); }
    finally { setSaving(false); }
  };

  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 104 }]}>
      <View style={styles.dashboard}>
        <View style={[styles.ring, { width: ringSize, height: ringSize }]} accessibilityLabel={`Dzisiejszy limit: ${goal == null ? "nieustawiony" : formatPln(goal)}. Wydano ${formatPln(spentToday)}.`}>
          <Svg width={ringSize} height={ringSize} viewBox="0 0 320 320" style={styles.ringSvg}>
            <Defs><LinearGradient id="dailyProgress" x1="0%" y1="100%" x2="100%" y2="0%"><Stop offset="0" stopColor={accent} /><Stop offset="1" stopColor={lightAccent} /></LinearGradient></Defs>
            <Circle cx={160} cy={160} r={148} stroke={surfaces.border} strokeOpacity={0.4} strokeWidth={16} fill="none" />
            {ratio > 0 ? <Circle cx={160} cy={160} r={148} stroke={negative ? "#b94b60" : "url(#dailyProgress)"} strokeWidth={16} fill="none" strokeLinecap="round" strokeDasharray={`${ratio * 929.911} 929.911`} rotation={-90} origin="160,160" /> : null}
          </Svg>
          <View style={styles.ringCenter}>
            <MaterialCommunityIcons name="piggy-bank-outline" size={36} color={accent} />
            <Text style={styles.ringLabel}>{isFamily ? "Dzisiejszy limit rodziny" : "Dzisiejszy limit"}</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.ringValue, { fontSize: ringSize * 0.12 }]}>{goal == null ? "—" : formatPln(goal)}</Text>
            <Text style={styles.ringSpent}>Wydano: {formatPln(spentToday)}</Text>
            <View style={[styles.remainingPill, { backgroundColor: negative ? "#f8dfe4" : "#daf0df" }]}><Text style={[styles.remainingText, { color: status }]}>{negative ? "Ponad limit: " : "Pozostało: "}{todayLeft == null ? "—" : formatPln(Math.abs(todayLeft))}</Text></View>
          </View>
        </View>
        <View style={styles.tiles}>
          {([
            { icon: "cart-outline", label: "Wydatki dziś", value: spentToday, green: false },
            { icon: "bullseye-arrow", label: "Limit dzienny", value: goal, green: false },
            { icon: "database-outline", label: negative ? "Ponad limit" : "Z limitu zostaje", value: todayLeft == null ? null : Math.abs(todayLeft), green: !negative },
          ] as const).map((item, index) => <Pressable key={item.label} accessibilityRole={index === 1 ? "button" : undefined} accessibilityLabel={index === 1 ? "Zmień dzienny limit" : undefined} disabled={index !== 1 || (!isFamily && (!canAdmin || profile?.accountType !== "personal"))} onPress={editLimit} style={[styles.tile, { backgroundColor: item.green ? "#e5f3e8" : surfaces.surface, borderColor: "rgba(255,255,255,0.8)" }]}>
            <View style={[styles.tileIcon, { backgroundColor: item.green ? "#d2ead7" : surfaces.surfaceStrong }]}><MaterialCommunityIcons name={item.icon} size={23} color={item.green ? "#247249" : accent} /></View>
            <Text style={styles.tileLabel}>{item.label}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tileValue, { color: item.green ? "#247249" : index === 2 && negative ? "#a33343" : "#1f1220" }]}>{item.value == null ? "—" : formatPln(item.value)}</Text>
          </Pressable>)}
        </View>
        {canAdmin && profile?.accountType === "personal" && !editing ? <Button compact textColor={accent} icon="pencil-outline" onPress={editLimit}>Zmień dzienny limit</Button> : null}
        {isFamily ? <>
          <Button textColor={accent} icon={familyLimitsOpen ? "chevron-up" : "account-edit-outline"} onPress={() => setFamilyLimitsOpen(open => !open)} accessibilityState={{ expanded: familyLimitsOpen }}>
            {familyLimitsOpen ? "Zwiń limity rodziny" : canAdmin ? "Edytuj limity rodziny" : "Pokaż limity rodziny"}
          </Button>
          {familyLimitsOpen ? <View style={styles.memberList}>
            {suggestedLimit != null ? <Text style={styles.hint}>Sugerowany wspólny limit z planu celu: {formatPln(suggestedLimit)} / dzień. Rozdziel zmianę między członków rodziny według własnego uznania.</Text> : null}
            {members.length === 0 ? <Text style={styles.hint}>Dodaj członków rodziny w profilu, aby ustawić ich limity.</Text> : null}
            {members.map(member => <View key={member.id} style={[styles.memberCard, { borderColor: surfaces.border }]}>
              <View style={styles.goalRow}>
                <View style={styles.memberCopy}>
                  <Text style={styles.sectionTitle}>{member.name}</Text>
                  <Text style={styles.memberValue}>{formatPln(member.dailySaldo ?? 0)}<Text style={styles.unit}> / dzień</Text></Text>
                </View>
                {canAdmin && editingMemberId !== member.id ? <Button disabled={saving} textColor={accent} accessibilityLabel={"Zmień limit: " + member.name} onPress={() => { setEditingMemberId(member.id); setDraft(String(member.dailySaldo ?? 0).replace(".", ",")); }}>Zmień</Button> : null}
              </View>
              {canAdmin && editingMemberId === member.id ? <View style={styles.editForm}>
                <TextInput outlineStyle={styles.inputOutline} style={{ backgroundColor: surfaces.surface }} outlineColor={surfaces.border} activeOutlineColor={accent} mode="outlined" label={"Dzienny limit: " + member.name + " (zł)"} value={draft} onChangeText={setDraft} keyboardType="decimal-pad" disabled={saving} />
                <Text style={styles.hint}>Wspólny cel i prognoza uwzględniają wpisany limit. Zapisz, aby go zachować.</Text>
                <View style={styles.actions}>
                  <Button disabled={saving} onPress={() => { setEditingMemberId(null); setDraft(""); }}>Anuluj</Button>
                  <Button style={styles.button} mode="contained" buttonColor={accent} loading={saving} disabled={saving || draftAmount == null} onPress={() => void saveMemberLimit()}>Zapisz limit</Button>
                </View>
              </View> : null}
            </View>)}
          </View> : null}
        </> : null}
        {editing ? <View style={styles.editForm}>
          <TextInput outlineStyle={styles.inputOutline} style={{ backgroundColor: surfaces.surface }} outlineColor={surfaces.border} activeOutlineColor={accent} mode="outlined" label="Dzienny cel (zł)" value={draft} onChangeText={setDraft} keyboardType="decimal-pad" disabled={saving} />
          <Text style={styles.hint}>Prognoza poniżej aktualizuje się podczas wpisywania.</Text>
          <View style={styles.actions}>
            <Button disabled={saving} onPress={() => setEditing(false)}>Anuluj</Button>
            <Button style={styles.button} mode="contained" buttonColor={accent} loading={saving} disabled={saving || parseAmount(draft) == null} onPress={() => void save()}>Zapisz cel</Button>
          </View>
        </View> : null}
      </View>

      <View style={[styles.tabs, { backgroundColor: tinycolor.mix(accent, "#ffffff", 94).toHexString() }]}>
        {(["month", "next"] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: period === value }} onPress={() => setPeriod(value)} style={[styles.tab, period === value && { backgroundColor: accent }]}>
          <Text style={[styles.tabLabel, period === value && { color: "#fff" }]}>{value === "month" ? "Do końca miesiąca" : "Do kolejnego wpływu"}</Text>
        </Pressable>)}
      </View>

      {!plan ? <Text style={styles.hint}>Ustaw stan portfela w profilu, aby zobaczyć prognozę.</Text> : !selected ? <Text style={styles.hint}>Dodaj stały wpływ z dniem miesiąca w profilu, aby zobaczyć prognozę do kolejnego wpływu.</Text> : <>
        <View style={[styles.forecast, { backgroundColor: surfaces.surface, borderColor: "rgba(255,255,255,0.85)" }]} accessibilityLiveRegion="polite">
          <View style={styles.forecastTop}>
            <View style={[styles.forecastIcon, { backgroundColor: surfaces.surfaceStrong }]}><MaterialCommunityIcons name={assessment && assessment.savings < 0 ? "trending-down" : "trending-up"} size={29} color={accent} /></View>
            <View style={styles.forecastCopy}>
              <Text style={styles.resultTitle}>{assessment && assessment.savings < 0 ? "Prognozowany niedobór" : period === "month" ? "Prognoza na koniec miesiąca" : "Prognoza do kolejnego wpływu"}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.savings, { color: assessment && assessment.savings < 0 ? "#a33343" : "#1f1220" }]}>{assessment ? formatPln(Math.abs(assessment.savings)) : "—"}</Text>
            </View>
          </View>
          <Text style={[styles.forecastHint, { borderTopColor: surfaces.border }]}>{assessment == null ? "Wpisz poprawny dzienny limit." : assessment.savings < 0 ? "Przy tym limicie zabraknie środków." : "Szacowana nadwyżka po zaplanowanych wydatkach."}</Text>
          <View style={[styles.dailyAllowance, { backgroundColor: surfaces.surfaceStrong }]}>
            <View style={styles.allowanceHeading}>
              <View style={styles.allowanceCopy}><Text style={styles.allowanceLabel}>Dostępne na dzień</Text><Text style={styles.smallHint}>Po rezerwie na zobowiązania</Text></View>
              <Text style={[styles.allowanceValue, { color: accent }]}>{formatPln(selected.daily)}</Text>
            </View>
            {goal != null ? <View style={styles.allowanceStatus}>
              <MaterialCommunityIcons name={goal > selected.daily ? "alert-circle-outline" : "check-circle-outline"} size={16} color={goal > selected.daily ? "#a33343" : "#247249"} />
              <Text style={[styles.allowanceNote, { color: goal > selected.daily ? "#a33343" : "#247249" }]}>{goal > selected.daily ? `Limit wyższy o ${formatPln(goal - selected.daily)} / dzień` : "Twój limit mieści się w budżecie"}</Text>
            </View> : null}
          </View>
          <Text style={styles.periodNote}>{selected.days} dni od dzisiaj{period === "next" ? " · bez dnia wpływu" : ""}</Text>
        </View>
        <View style={styles.monthSection}>
          <View style={styles.monthHeading}><Text style={styles.sectionTitle}>Postęp w miesiącu</Text><Text style={styles.hint}>{now.toLocaleDateString("pl-PL", { month: "long", year: "numeric" })}</Text></View>
          <View style={styles.monthProgressRow}>
            <View style={[styles.monthTrack, { backgroundColor: surfaces.border }]} accessibilityRole="progressbar" accessibilityLabel="Wykorzystanie miesięcznych limitów" accessibilityValue={{ min: 0, max: 100, now: Math.min(100, Math.round(monthRatio * 100)) }}><View style={[styles.monthFill, { width: `${Math.min(1, monthRatio) * 100}%`, backgroundColor: monthRatio > 1 ? "#b94b60" : accent }]} /></View>
            <Text style={styles.monthPercent}>{Math.round(monthRatio * 100)}%</Text>
          </View>
          <View style={styles.monthHeading}><Text style={styles.hint}>Wydano: {formatPln(monthSpent)}</Text><Text style={styles.hint}>z {monthBudget == null ? "—" : formatPln(monthBudget)}</Text></View>
          <Text style={styles.smallHint}>Codzienne wydatki względem limitu × liczba dni miesiąca. Bez stałych zobowiązań.</Text>
        </View>
        <Pressable style={[styles.explanationToggle, { backgroundColor: surfaces.surfaceStrong }]} accessibilityRole="button" accessibilityState={{ expanded: explanationOpen }} onPress={() => setExplanationOpen(open => !open)}>
          <View style={styles.explanationCopy}><MaterialCommunityIcons name="lightbulb-outline" size={25} color={accent} /><View style={styles.forecastCopy}><Text style={styles.resultTitle}>Jak liczymy prognozę?</Text><Text style={styles.smallHint}>Zobacz, co bierzemy pod uwagę.</Text></View></View>
          <MaterialCommunityIcons name={explanationOpen ? "chevron-up" : "chevron-down"} size={22} color={accent} />
        </Pressable>
        {explanationOpen ? <Text style={styles.hint}>{isFamily ? "Uwzględniamy wspólny portfel i operacje całej rodziny. " : ""}Od dostępnych środków odejmujemy rezerwę na stałe oraz zapisane przyszłe wydatki, a potem wydatki według dziennego celu. Dzisiejsze wydatki pomniejszają pozostały cel na dzisiaj. Przyszłe wpływy nie zwiększają dostępnych środków. Prognoza zmienia się wraz z zapisami w portfelu.</Text> : null}
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  dailyAllowance: { borderRadius: 13, padding: 13, gap: 10, marginVertical: 3 },
  allowanceHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  allowanceCopy: { flexGrow: 1, gap: 2 },
  allowanceLabel: { fontFamily: "MontserratSemiBold", fontSize: 12, color: "#32213d" },
  allowanceValue: { fontFamily: "MontserratSemiBold", fontSize: 20, fontVariant: ["tabular-nums"] },
  allowanceStatus: { flexDirection: "row", gap: 6, alignItems: "center" },
  allowanceNote: { fontFamily: "PoppinsRegular", fontSize: 11, lineHeight: 17, flex: 1 },
  dashboard: { alignItems: "stretch", gap: 12 },
  ring: { alignSelf: "center", alignItems: "center", justifyContent: "center", marginTop: 0, marginBottom: 2 },
  ringSvg: { position: "absolute" },
  ringCenter: { width: "76%", alignItems: "center", gap: 8 },
  ringLabel: { fontFamily: "PoppinsRegular", fontSize: 14, textAlign: "center", color: "#24122e" },
  ringValue: { fontFamily: "MontserratSemiBold", letterSpacing: -1.1, color: "#1d0c2a", width: "100%", textAlign: "center", fontVariant: ["tabular-nums"] },
  ringSpent: { fontFamily: "PoppinsRegular", fontSize: 14, color: "#32213d" },
  remainingPill: { borderRadius: 22, paddingHorizontal: 13, paddingVertical: 7 },
  remainingText: { fontFamily: "MontserratSemiBold", fontSize: 12, textAlign: "center" },
  tiles: { flexDirection: "row", gap: 10 },
  tile: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 7, paddingVertical: 13, borderRadius: 18, borderWidth: 1, gap: 6, shadowColor: "#45243f", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 5, elevation: 2 },
  tileIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  tileLabel: { fontFamily: "PoppinsRegular", fontSize: 10, lineHeight: 16, textAlign: "center", color: "#32213d" },
  tileValue: { fontFamily: "MontserratSemiBold", fontSize: 16, width: "100%", textAlign: "center", fontVariant: ["tabular-nums"] },
  forecastTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  forecastIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  forecastCopy: { flex: 1, gap: 4 },
  monthSection: { gap: 12, paddingVertical: 8 },
  monthHeading: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" },
  monthProgressRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  monthTrack: { flex: 1, height: 12, borderRadius: 8, overflow: "hidden" },
  monthFill: { height: "100%", borderRadius: 8 },
  monthPercent: { fontFamily: "MontserratSemiBold", fontSize: 18, color: "#24122e" },
  smallHint: { fontFamily: "PoppinsRegular", fontSize: 11, lineHeight: 17, color: "#78677d" },
  explanationCopy: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  button: { borderRadius: 12 },
  inputOutline: { borderRadius: 12 },
  forecastHint: { borderTopWidth: 1, paddingTop: 9, fontFamily: "PoppinsRegular", fontSize: 13, lineHeight: 22, color: "#6b5f6a" },
  root: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, gap: 18, width: "100%", maxWidth: 640, alignSelf: "center" },
  sectionTitle: { fontFamily: "MontserratSemiBold", fontSize: 16, lineHeight: 24, color: "#1f1220" },
  goalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  unit: { fontFamily: "PoppinsRegular", fontSize: 13, color: "#6b5f6a" },
  hint: { fontFamily: "PoppinsRegular", fontSize: 13, lineHeight: 21, color: "#6b5f6a" },
  memberList: { gap: 20, marginTop: 8 },
  memberCard: { borderTopWidth: 1, paddingTop: 20, gap: 12 },
  memberCopy: { flex: 1, gap: 8 },
  memberValue: { fontFamily: "PoppinsRegular", fontSize: 18, color: "#514452" },
  editForm: { gap: 14, marginTop: 12 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" },
  tabs: { flexDirection: "row", padding: 4, borderRadius: 12, gap: 4 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  tabLabel: { fontFamily: "MontserratSemiBold", fontSize: 12, lineHeight: 18, textAlign: "center", color: "#514452" },
  forecast: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 9, shadowColor: "#45243f", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 5, elevation: 2 },
  resultTitle: { fontFamily: "MontserratSemiBold", fontSize: 14, lineHeight: 21, flexShrink: 1 },
  savings: { fontFamily: "MontserratSemiBold", fontSize: 27, lineHeight: 36, letterSpacing: -0.8, color: "#1f1220", fontVariant: ["tabular-nums"] },
  periodNote: { fontFamily: "MontserratSemiBold", fontSize: 12, lineHeight: 20, color: "#6b5f6a" },
  explanationToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 16, borderRadius: 18 },
});
