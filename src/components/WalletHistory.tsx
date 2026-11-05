import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { Member, Transaction, User } from "../db/interfaces";
import { useAccent } from "../contexts/ThemeContext";
import { formatPln } from "../helpers/money";
import { ownerLabel } from "../helpers/owners";
import { walletHistoryDays } from "../helpers/walletHistory";

export default function WalletHistory({ profile, entries, members }: { profile: User | null; entries: Transaction[]; members: Member[] }) {
  const { accent, surfaces } = useAccent();
  const [visibleDays, setVisibleDays] = useState(7);
  const days = walletHistoryDays(profile, entries);
  return <View style={styles.days}>
      <Text style={styles.hint}>Wpływy, wydatki, korekty salda i usunięcia transakcji według dni. Zaplanowane przyszłe operacje pojawią się w swoim dniu. Historia transakcji odzwierciedla ich aktualne dane.</Text>
      <Text style={styles.hint}>Ręczne korekty zapisujemy od wprowadzenia historii. Dla starszego portfela dostępny jest ostatni znany stan.</Text>
      {days.length ? days.slice(0, visibleDays).map(day => <View key={day.date} style={[styles.day, { borderColor: surfaces.border }]}>
        <Text style={styles.title}>{day.date.split("-").reverse().join(".")}</Text>
        {day.transactions.length ? <Text style={styles.hint}>Wpływy: {formatPln(day.income)} · Wydatki: {formatPln(day.expense)}</Text> : null}
        {day.adjustments.some(item => item.before != null) ? <Text style={styles.hint}>Zmiana przez korekty: {day.correction > 0 ? "+" : ""}{formatPln(day.correction)}</Text> : null}
        {day.adjustments.map(item => <View key={item.id} style={[styles.adjustment, { backgroundColor: surfaces.surfaceStrong }]}>
          <Text style={styles.title}>{item.reason === "transaction_updated" ? "Edycja transakcji" : item.reason === "transaction_deleted" ? (item.deletedTransaction?.type === "income" ? "Usunięcie wpływu" : "Usunięcie wydatku") : item.createdAt == null ? "Ostatni znany stan" : item.before == null ? "Ręczne ustawienie salda" : item.before === item.after ? "Ręczny zapis salda bez zmiany" : "Ręczna korekta salda"}</Text>
          {item.editedTransaction ? <Text style={styles.hint}>{item.editedTransaction.after.name || item.editedTransaction.after.category}{" · "}{formatPln(item.editedTransaction.before.amount)} → {formatPln(item.editedTransaction.after.amount)}</Text> : null}
          {item.deletedTransaction ? <Text style={styles.hint}>{item.deletedTransaction.name || item.deletedTransaction.category} · {item.deletedTransaction.date.split("-").reverse().join(".")}{" · "}{item.deletedTransaction.type === "expense" ? "+" : "−"}{formatPln(item.deletedTransaction.amount)}</Text> : null}
          <Text style={[styles.amount, { color: accent }]}>{item.before == null ? formatPln(item.after) : formatPln(item.before) + " → " + formatPln(item.after)}</Text>
          {item.createdAt ? <Text style={styles.hint}>{new Date(item.createdAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</Text> : null}
        </View>)}
        {day.transactions.map(item => <View key={item.id} style={styles.transaction}>
          <View style={styles.copy}>
            <Text style={styles.label}>{item.name || item.category}</Text>
            <Text style={styles.hint}>{item.category}{profile?.accountType === "family" ? " · " + ownerLabel(item.memberId, members) : ""}</Text>
          </View>
          <Text style={[styles.transactionAmount, { color: item.type === "income" ? "#28704a" : "#a33343" }]}>{item.type === "income" ? "+" : "−"}{formatPln(item.amount)}</Text>
        </View>)}
      </View>) : <Text style={styles.hint}>Brak zapisów w historii portfela.</Text>}
      {days.length > visibleDays ? <Button onPress={() => setVisibleDays(count => count + 7)} textColor={accent}>Pokaż wcześniejsze dni</Button> : null}
  </View>;
}

const styles = StyleSheet.create({
  title: { fontFamily: "MontserratSemiBold", fontSize: 14, color: "#3d323c", flexShrink: 1 },
  days: { gap: 20 },
  day: { borderTopWidth: 1, paddingTop: 20, gap: 14 },
  hint: { fontFamily: "PoppinsRegular", color: "#6b5f6a", fontSize: 12, lineHeight: 19 },
  adjustment: { padding: 16, borderRadius: 14, gap: 10 },
  amount: { fontFamily: "MontserratSemiBold", fontSize: 19 },
  transaction: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  copy: { flex: 1, gap: 4 },
  label: { fontFamily: "PoppinsRegular", fontSize: 14, color: "#3d323c" },
  transactionAmount: { fontFamily: "MontserratSemiBold", fontSize: 14, flexShrink: 1 },
});
