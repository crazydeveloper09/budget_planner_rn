import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFinance } from "../../contexts/FinanceContext";
import { useProfile } from "../../contexts/ProfileContext";
import { useAccent } from "../../contexts/ThemeContext";
import { buildFamilyMonthStats } from "../../helpers/familyStats";
import { formatMonthLabel, monthKeyFromDate, shiftMonth } from "../../helpers/monthKey";
import { formatPln } from "../../helpers/money";

const RankingsScreen: React.FC = () => {
  const { accent, surfaces } = useAccent();
  const { members } = useProfile();
  const { entries } = useFinance();
  const currentMonth = monthKeyFromDate(new Date());
  const [month, setMonth] = useState(currentMonth);
  const stats = useMemo(() => buildFamilyMonthStats(entries, members, month), [entries, members, month]);
  const maxCategory = stats.categories[0]?.amount ?? 0;
  const canGoNext = month < currentMonth;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.monthRow}>
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={8} style={styles.monthBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={accent} />
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonthLabel(month)}</Text>
        <Pressable
          onPress={() => canGoNext && setMonth(shiftMonth(month, 1))}
          hitSlop={8}
          style={[styles.monthBtn, !canGoNext && styles.monthBtnOff]}
        >
          <MaterialCommunityIcons name="chevron-right" size={28} color={canGoNext ? accent : "#cbb7c4"} />
        </Pressable>
      </View>

      <Text style={styles.kicker}>Kategorie w tym miesiącu</Text>
      <Text style={styles.totals}>
        Wydatki {formatPln(stats.totalExpenses)}
        {stats.totalIncome > 0 ? ` · wpływy ${formatPln(stats.totalIncome)}` : ""}
      </Text>
      {stats.categories.length === 0 ? (
        <Text style={styles.empty}>Jeszcze pusto. Dodajcie wydatki, kategorie same się poukładają.</Text>
      ) : (
        <View style={styles.catList}>
          {stats.categories.map((item) => (
            <View key={item.label} style={styles.catRow}>
              <View style={[styles.catIcon, { backgroundColor: `${item.tint}33` }]}>
                <MaterialCommunityIcons name={item.icon as never} size={18} color={item.tint} />
              </View>
              <View style={styles.catBody}>
                <View style={styles.catTop}>
                  <Text style={styles.catName}>{item.label}</Text>
                  <Text style={styles.catAmount}>{formatPln(item.amount)}</Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: surfaces.surface }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: accent,
                        width: `${maxCategory > 0 ? Math.max(6, (item.amount / maxCategory) * 100) : 0}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.kicker, styles.awardsKicker]}>Podium rodziny</Text>
      <Text style={styles.deck}>Medale za charakter. I za paragon.</Text>
      {stats.awards.map((award) => (
        <View key={award.id} style={[styles.card, { backgroundColor: surfaces.surface }]}>
          <Text style={styles.emoji}>{award.emoji}</Text>
          <Text style={styles.cardTitle}>{award.title}</Text>
          <Text style={styles.cardPunch}>{award.punch}</Text>
          <Text style={[styles.winner, { color: accent }]}>{award.detail}</Text>
          {award.ranking.length > 1
            ? award.ranking.map((row, index) => (
                <Text key={row.name} style={styles.rankLine}>
                  {index + 1}. {row.name} · {row.label}
                </Text>
              ))
            : null}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  monthBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  monthBtnOff: {
    opacity: 0.45,
  },
  monthLabel: {
    fontFamily: "MontserratSemiBold",
    fontSize: 18,
    color: "#1f1220",
  },
  kicker: {
    fontFamily: "MontserratSemiBold",
    fontSize: 13,
    color: "#6b5f6a",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  totals: {
    fontFamily: "PoppinsRegular",
    fontSize: 14,
    color: "#1f1220",
    marginBottom: 14,
  },
  empty: {
    fontFamily: "PoppinsRegular",
    fontSize: 14,
    color: "#6b5f6a",
    lineHeight: 20,
    marginBottom: 8,
  },
  catList: {
    gap: 12,
    marginBottom: 8,
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  catBody: {
    flex: 1,
  },
  catTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  catName: {
    fontFamily: "MontserratSemiBold",
    fontSize: 14,
    color: "#1f1220",
  },
  catAmount: {
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    color: "#5c5160",
  },
  barTrack: {
    height: 8,
    borderRadius: 8,
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    borderRadius: 8,
  },
  awardsKicker: {
    marginTop: 28,
  },
  deck: {
    fontFamily: "PoppinsRegular",
    fontSize: 14,
    color: "#6b5f6a",
    marginBottom: 14,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  emoji: {
    fontSize: 26,
    marginBottom: 6,
  },
  cardTitle: {
    fontFamily: "MontserratSemiBold",
    fontSize: 18,
    color: "#1f1220",
  },
  cardPunch: {
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    color: "#6b5f6a",
    marginTop: 4,
    marginBottom: 8,
  },
  winner: {
    fontFamily: "MontserratSemiBold",
    fontSize: 15,
    marginBottom: 6,
  },
  rankLine: {
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    color: "#5c5160",
    marginTop: 2,
  },
});

export default RankingsScreen;
