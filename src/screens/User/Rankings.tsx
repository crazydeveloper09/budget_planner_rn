import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { IconButton, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFinance } from "../../contexts/FinanceContext";
import { useProfile } from "../../contexts/ProfileContext";
import { useAccent } from "../../contexts/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { buildFamilyMonthStats, entriesInMonth, spendByCategory } from "../../helpers/familyStats";
import { personalSpendComment } from "../../helpers/spendComment";
import { formatMonthLabel, monthKeyFromDate, shiftMonth } from "../../helpers/monthKey";
import { formatPln } from "../../helpers/money";
import { parsePickedDate, toIsoDate } from "../../helpers/dates";
import { ownerLabel } from "../../helpers/owners";
import { recurringDate } from "../../helpers/spendingPlan";
import { Transaction } from "../../db/interfaces";

const RankingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { accent, surfaces } = useAccent();
  const { members, profile } = useProfile();
  const { entries } = useFinance();
  const isFamily = profile?.accountType === "family";
  const currentMonth = monthKeyFromDate(new Date());
  const [month, setMonth] = useState(currentMonth);
  const [selected, setSelected] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const monthEntries = useMemo(() => entriesInMonth(entries, month), [entries, month]);
  const stats = useMemo(() => {
    if (isFamily) return buildFamilyMonthStats(entries, members, month);
    const { categories, totalExpenses, totalIncome } = spendByCategory(monthEntries);
    return { awards: [], categories, totalExpenses, totalIncome };
  }, [entries, isFamily, members, month, monthEntries]);
  const comment = useMemo(
    () => (isFamily ? null : personalSpendComment(stats.categories, stats.totalExpenses, month)),
    [isFamily, month, stats.categories, stats.totalExpenses]
  );
  const canGoNext = month < currentMonth;
  const categories = stats.categories;
  const days = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    if (selected === null) return [];
    const monthStart = parsePickedDate(`${month}-01`);
    for (const entry of monthEntries) {
      if (entry.type !== "expense" || entry.category !== selected) continue;
      const date = entry.regular
        ? toIsoDate(recurringDate(entry, monthStart))
        : entry.date;
      const group = groups.get(date) ?? [];
      group.push(entry);
      groups.set(date, group);
    }
    return [...groups].sort(([a], [b]) => b.localeCompare(a)).map(([date, operations]) => ({ date, operations }));
  }, [month, monthEntries, selected]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: isFamily ? "Ranking rodziny" : "Podsumowanie miesiąca",
    });
  }, [isFamily, navigation]);

  const renderCategories = () => {
    const max = categories[0]?.amount ?? 0;
    return (
      <View style={styles.catList}>
        {categories.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            onPress={() => {
              setExpandedDay(null);
              setSelected(item.label);
            }}
            style={({ pressed }) => [styles.catRow, pressed && { backgroundColor: surfaces.surface }]}
          >
            <View style={[styles.catIcon, { backgroundColor: `${item.tint}33` }]}>
              <MaterialCommunityIcons name={item.icon as never} size={18} color={item.tint} />
            </View>
            <View style={styles.catBody}>
              <View style={styles.catTop}>
                <Text style={styles.catName}>{item.label || "Bez kategorii"}</Text>
                <Text style={styles.catAmount}>{formatPln(item.amount)}</Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: surfaces.surface }]}>
                <View style={[styles.barFill, { backgroundColor: accent, width: `${Math.max(6, (item.amount / max) * 100)}%` }]} />
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={accent} />
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <>
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
        {categories.length ? renderCategories() : (
          <Text style={styles.empty}>Brak wydatków w tym miesiącu.</Text>
        )}
        {comment ? (
          <View style={[styles.commentCard, { backgroundColor: surfaces.surface }]}>
            <Text style={styles.comment}>{comment}</Text>
          </View>
        ) : null}

        {isFamily ? (
          <>
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
          </>
        ) : null}
      </ScrollView>
      {selected !== null ? (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSelected(null)}>
          <SafeAreaView style={styles.detailOverlay}>
            <View accessibilityViewIsModal style={styles.detailDialog}>
              <View style={styles.detailHeader}>
                <View style={styles.catBody}>
                  <Text style={styles.cardTitle}>{selected || "Bez kategorii"}</Text>
                  <Text style={styles.catAmount}>{formatMonthLabel(month)}</Text>
                </View>
                <IconButton icon="close" style={styles.detailClose} accessibilityLabel="Zamknij" onPress={() => setSelected(null)} />
              </View>
              <FlatList
                style={styles.detailList}
                data={days}
                extraData={expandedDay}
                keyExtractor={(item) => item.date}
                ListEmptyComponent={<Text style={styles.empty}>Brak operacji w tej kategorii.</Text>}
                renderItem={({ item }) => {
                  const expanded = expandedDay === item.date;
                  return (
                    <View style={[styles.dayGroup, { borderColor: surfaces.border }]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                        onPress={() => setExpandedDay(expanded ? null : item.date)}
                        style={[styles.dayHeader, { backgroundColor: surfaces.surface }]}
                      >
                        <Text style={[styles.catName, styles.catBody]}>{parsePickedDate(item.date).toLocaleDateString("pl-PL")}</Text>
                        <Text style={styles.catAmount}>{item.operations.length}</Text>
                        <MaterialCommunityIcons name={expanded ? "chevron-up" : "chevron-down"} size={22} color={accent} />
                      </Pressable>
                      {expanded ? item.operations.map((entry) => (
                        <View key={entry.id} style={[styles.detailRow, { borderTopColor: surfaces.border }]}>
                          <View style={styles.catBody}>
                            <Text style={styles.catName}>{entry.name || entry.category || "Bez nazwy"}</Text>
                            <Text style={styles.catAmount}>
                              Wydatek
                              {entry.regular ? " · Co miesiąc" : ""}
                              {isFamily ? ` · ${ownerLabel(entry.memberId, members)}` : ""}
                            </Text>
                          </View>
                            <Text style={styles.catName}>−{formatPln(entry.amount)}</Text>
                        </View>
                      )) : null}
                    </View>
                  );
                }}
              />
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
    paddingBottom: 140,
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
  commentCard: {
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  comment: {
    fontFamily: "PoppinsRegular",
    fontSize: 15,
    color: "#1f1220",
    lineHeight: 22,
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
    borderRadius: 12,
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
  detailOverlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 14, backgroundColor: "rgba(26,12,31,0.58)" },
  detailDialog: { width: "100%", maxWidth: 500, maxHeight: "90%", borderRadius: 26, backgroundColor: "#fff", paddingHorizontal: 18, paddingVertical: 10 },
  detailHeader: { flexDirection: "row", alignItems: "flex-start", paddingBottom: 8 },
  detailClose: { margin: 0, marginRight: -8 },
  detailList: { flexGrow: 0, flexShrink: 1 },
  dayGroup: { borderWidth: 1, borderRadius: 14, overflow: "hidden", marginBottom: 8 },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, padding: 12 },
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
