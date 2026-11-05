import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getCategoryOption } from "../helpers/categories";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ActivityIndicator, Button, IconButton, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useProfile } from "../contexts/ProfileContext";
import { useFinance } from "../contexts/FinanceContext";
import { useAccent } from "../contexts/ThemeContext";
import { expenseOutlook } from "../helpers/goalPlan";
import { formatPln } from "../helpers/money";
import { toIsoDate } from "../helpers/dates";

type Request = { remaining: number | null; amount: number; isExpense: boolean; title?: string; category?: string; date?: string; excludeEntryId?: number; onReschedule?: (date: string) => void };
export function useBudgetGuard() {
  const { profile, members, addGoal } = useProfile();
  const { entries } = useFinance();
  const { accent, surfaces } = useAccent();

  const [request, setRequest] = useState<Request | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef<((value: boolean) => void) | null>(null);
  useEffect(() => () => { pending.current?.(false); pending.current = null; }, []);
  const finish = (value: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setRequest(null);
    resolve?.(value);
  };
  const confirmIfOverBudget = (input: Request): Promise<boolean> => {
    if (!input.isExpense || input.remaining == null || input.amount <= input.remaining + 0.001) return Promise.resolve(true);
    if (pending.current) return Promise.resolve(false);
    return new Promise(resolve => { pending.current = resolve; setRequest(input); });
  };
  const outlook = useMemo(() => request ? expenseOutlook(profile, members, entries.filter(e => e.id !== request.excludeEntryId), request.amount, toIsoDate(new Date()), request.date) : null, [request, profile, members, entries]);
  const displayDate = (date: string) => date.split("-").reverse().join(".");
  const shortage = Math.max(0, (request?.amount ?? 0) - (request?.remaining ?? 0));
  const saveAsGoal = async () => {
    if (!request || saving) return;
    setSaving(true);
    try {
      await addGoal({ title: request.title || "Planowany wydatek", targetAmount: request.amount, savedAmount: 0, deadline: null });
      finish(false);
      Alert.alert("Dodano cel", "Znajdziesz go w profilu. Otwórz jego plan, aby sprawdzić możliwości oszczędzania.");
    } catch { Alert.alert("Nie dodano celu", "Spróbuj ponownie."); }
    finally { setSaving(false); }
  };
  const action = (icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"], title: string, subtitle: string, onPress: () => void, green = false, loading = false) => <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: saving, busy: loading }} disabled={saving} onPress={onPress} style={({ pressed }) => [styles.action, { backgroundColor: green ? "#e3f3e5" : surfaces.surfaceStrong, opacity: saving && !loading ? 0.5 : pressed ? 0.75 : 1 }]}>
    <View style={[styles.actionIcon, { backgroundColor: green ? "#cfebd3" : surfaces.surface }]}>{loading ? <ActivityIndicator size={23} color="#247249" /> : <MaterialCommunityIcons name={icon} size={26} color={green ? "#247249" : accent} />}</View>
    <View style={styles.copy}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionHint}>{subtitle}</Text></View>
    <MaterialCommunityIcons name="chevron-right" size={23} color={green ? "#285e36" : accent} />
  </Pressable>;
  const modal = <Modal visible={request != null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { if (!saving) finish(false); }}>
    <SafeAreaView style={styles.overlay} edges={["top", "bottom", "left", "right"]}>
      <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: surfaces.surface }]}>
        <IconButton icon="close" size={25} iconColor="#21112d" accessibilityLabel="Zamknij" disabled={saving} onPress={() => finish(false)} style={styles.close} />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={[styles.illustration, { backgroundColor: surfaces.surfaceStrong }]}>
            <MaterialCommunityIcons name="cart-outline" size={53} color={accent} />
            <View style={styles.alertBadge}><MaterialCommunityIcons name="exclamation" size={22} color="#fff" /></View>
          </View>
          <Text style={styles.title}>Wydatek przekracza{ '\n' }Twój aktualny budżet</Text>
          <Text style={styles.intro}>Brakuje Ci <Text style={styles.bold}>{formatPln(shortage)}</Text>, aby zrealizować ten wydatek{request?.date ? " w dniu " + displayDate(request.date) : " dzisiaj"}.</Text>
          <View style={[styles.expense, { borderColor: surfaces.border }]}>
            <View style={[styles.expenseIcon, { backgroundColor: surfaces.surfaceStrong }]}><MaterialCommunityIcons name={getCategoryOption(request?.category ?? "", "expense")?.icon ?? "shopping-outline"} size={30} color={accent} /></View>
            <View style={styles.copy}><Text style={styles.actionTitle}>{request?.title || "Planowany wydatek"}</Text><Text style={[styles.amount, { color: accent }]}>{formatPln(request?.amount ?? 0)}</Text></View>
          </View>
          <View style={[styles.forecast, { backgroundColor: surfaces.surfaceStrong }]}>
            <View style={styles.forecastTop}><MaterialCommunityIcons name="calendar-check-outline" size={23} color={accent} /><Text style={styles.forecastLabel}>{outlook?.date ? "Pierwszy możliwy termin zakupu" : "Brak terminu bez niedoboru"}</Text></View>
            {outlook?.date ? <View style={[styles.datePanel, { backgroundColor: surfaces.surface }]}>
              <Text style={[styles.dateText, { color: accent }]}>{displayDate(outlook.date)}</Text>
              <Text style={styles.dateCountdown}>{outlook.days === 0 ? "Już dzisiaj" : outlook.days === 1 ? "Za 1 dzień" : "Za " + outlook.days + " dni"}</Text>
            </View> : null}
            <Text style={styles.forecastExplanation}>{outlook?.date ? "Według prognozy zakup w tym dniu nie spowoduje niedoboru przez kolejne 12 miesięcy. To szacunek, nie gwarancja." : "Przy obecnym planie nie znajdujemy terminu zakupu bez późniejszych niedoborów w najbliższych 365 dniach."}</Text>
          </View>
          {outlook?.cashDate && outlook.riskDate ? <View style={styles.riskBox}><Text style={styles.riskTitle}>Chwilowo wystarczy, ale później zabraknie</Text><Text style={styles.riskText}>Saldo pokryje zakup {displayDate(outlook.cashDate)}, jednak od {displayDate(outlook.riskDate)} prognoza po zakupie pokazuje niedobór. Największy: {formatPln(outlook.shortfall)}. Może to wymagać ograniczenia wydatków lub zadłużenia.</Text></View> : null}
          <Text style={styles.sectionTitle}>Co chcesz zrobić?</Text>
          <View style={styles.actions}>
            {action("bullseye-arrow", "Zapisz jako cel", "Zacznij odkładać na ten wydatek.", () => { void saveAsGoal(); }, true, saving)}
            {outlook?.date && request?.onReschedule ? action("calendar-arrow-right", "Wybierz termin bez niedoboru", "Przesuń wydatek na proponowany dzień.", () => { if (outlook.date) request.onReschedule?.(outlook.date); finish(false); }) : null}
            {action("pencil-outline", "Wróć do edycji kwoty", "Zmień kwotę wydatku.", () => finish(false))}
          </View>
          <View style={[styles.override, { borderTopColor: surfaces.border }]}>
            <Button mode="outlined" icon="alert-outline" style={[styles.overrideButton, { borderColor: accent }]} contentStyle={styles.overrideContent} textColor={accent} disabled={saving} onPress={() => finish(true)}>Zapisz mimo niedoboru</Button>
            <Text style={styles.overrideHint}>Na wybrany dzień zabraknie {formatPln(shortage)}. Zapisanie operacji nie zapewnia jej finansowania.</Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  </Modal>;
  return { confirmIfOverBudget, budgetGuardModal: modal };
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(26,12,31,0.58)", paddingHorizontal: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  dialog: { width: "100%", maxWidth: 500, maxHeight: "100%", borderRadius: 26, overflow: "hidden", shadowColor: "#1c1024", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.24, shadowRadius: 30, elevation: 16 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  close: { position: "absolute", top: 4, right: 4, zIndex: 2 },
  content: { padding: 18, paddingTop: 28, paddingBottom: 12, gap: 14 },
  illustration: { width: 92, height: 78, borderRadius: 32, alignSelf: "center", alignItems: "center", justifyContent: "center", marginTop: 2 },
  alertBadge: { position: "absolute", right: -1, top: 0, width: 29, height: 29, borderRadius: 15, backgroundColor: "#df355f", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  title: { fontFamily: "MontserratSemiBold", fontSize: 23, lineHeight: 30, textAlign: "center", color: "#21112d" },
  intro: { fontFamily: "PoppinsRegular", fontSize: 13, lineHeight: 21, textAlign: "center", color: "#62586a", marginBottom: 3 },
  bold: { fontFamily: "MontserratSemiBold", color: "#21112d" },
  expense: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 15, padding: 9 },
  expenseIcon: { width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 3 },
  amount: { fontFamily: "MontserratSemiBold", fontSize: 23, fontVariant: ["tabular-nums"] },
  forecast: { padding: 15, borderRadius: 16, gap: 12 },
  forecastTop: { flexDirection: "row", gap: 11, alignItems: "center" },
  forecastLabel: { flex: 1, fontFamily: "MontserratSemiBold", fontSize: 13, lineHeight: 20, color: "#21112d" },
  datePanel: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, gap: 8 },
  dateText: { fontFamily: "MontserratSemiBold", fontSize: 21, lineHeight: 28, letterSpacing: -0.3, textAlign: "center", fontVariant: ["tabular-nums"] },
  dateCountdown: { fontFamily: "PoppinsRegular", fontSize: 12, color: "#32213d", textAlign: "center" },
  forecastExplanation: { fontFamily: "PoppinsRegular", fontSize: 11, lineHeight: 18, color: "#62586a" },
  sectionTitle: { fontFamily: "MontserratSemiBold", fontSize: 18, color: "#21112d", marginTop: 2 },
  actions: { gap: 8 },
  action: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 15, padding: 11, minHeight: 66 },
  actionIcon: { width: 42, height: 42, flexShrink: 0, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionTitle: { fontFamily: "MontserratSemiBold", fontSize: 14, lineHeight: 19, color: "#21112d" },
  actionHint: { fontFamily: "PoppinsRegular", fontSize: 11, lineHeight: 17, color: "#514452" },
  riskBox: { backgroundColor: "#f8e9df", padding: 12, borderRadius: 13, gap: 5 },
  riskTitle: { fontFamily: "MontserratSemiBold", fontSize: 12, color: "#8c4633" },
  riskText: { fontFamily: "PoppinsRegular", fontSize: 11, lineHeight: 18, color: "#754b3d" },
  override: { borderTopWidth: 1, paddingTop: 14, marginTop: 2, gap: 8 },
  overrideButton: { borderRadius: 13 },
  overrideContent: { paddingVertical: 5 },
  overrideHint: { fontFamily: "PoppinsRegular", fontSize: 11, lineHeight: 18, textAlign: "center", color: "#6b5f6a" },
});
