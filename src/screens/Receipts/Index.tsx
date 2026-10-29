import React, { useMemo, useState } from "react";
import { Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFinance } from "../../contexts/FinanceContext";
import { useAccent } from "../../contexts/ThemeContext";
import ReceiptPreviewModal from "../../components/ReceiptPreviewModal";
import { Receipt } from "../../db/interfaces";
import { formatPln } from "../../helpers/money";
import AddReceiptModal from "./AddReceiptModal";

function formatDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("pl-PL");
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  const label = new Date(year, month - 1, 1).toLocaleDateString("pl-PL", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const ReceiptsIndexScreen: React.FC = () => {
  const { accent, surfaces } = useAccent();
  const { receipts, removeReceipt } = useFinance();
  const [open, setOpen] = useState<Receipt | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  const thisMonth = monthKey(new Date().toISOString().slice(0, 10));
  const months = useMemo(() => {
    const keys = Array.from(new Set(receipts.map((item) => monthKey(item.date)))).sort().reverse();
    if (!keys.includes(thisMonth)) keys.unshift(thisMonth);
    return keys;
  }, [receipts, thisMonth]);
  const categories = useMemo(
    () => Array.from(new Set(receipts.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pl")),
    [receipts]
  );

  const data = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return receipts.filter((item) => {
      if (month && monthKey(item.date) !== month) return false;
      if (category && item.category !== category) return false;
      if (!needle) return true;
      const hay = `${item.name} ${item.category} ${item.ownerName ?? ""} ${item.amount}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [category, month, query, receipts]);

  const filtersOn = Boolean(query.trim() || month || category);

  const confirmDelete = (id: string) => {
    Alert.alert("Usunąć paragon?", "Zdjęcie zniknie z telefonu i z rodzinnego budżetu.", [
      { text: "Anuluj", style: "cancel" },
      {
        text: "Usuń",
        style: "destructive",
        onPress: () => {
          setOpen(null);
          void removeReceipt(id);
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <TextInput
          mode="outlined"
          placeholder="Szukaj sklepu, kategorii, kwoty…"
          value={query}
          onChangeText={setQuery}
          dense
          style={styles.search}
          outlineColor={surfaces.border}
          activeOutlineColor={accent}
          left={<TextInput.Icon icon="magnify" />}
          right={query ? <TextInput.Icon icon="close" onPress={() => setQuery("")} /> : undefined}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable
            onPress={() => setMonth(null)}
            style={[styles.chip, { borderColor: surfaces.border }, !month && { borderColor: accent, backgroundColor: surfaces.surfaceStrong }]}
          >
            <Text style={[styles.chipText, !month && { color: accent }]}>Wszystkie daty</Text>
          </Pressable>
          {months.map((key) => (
            <Pressable
              key={key}
              onPress={() => setMonth((current) => (current === key ? null : key))}
              style={[
                styles.chip,
                { borderColor: surfaces.border },
                month === key && { borderColor: accent, backgroundColor: surfaces.surfaceStrong },
              ]}
            >
              <Text style={[styles.chipText, month === key && { color: accent }]}>
                {key === thisMonth ? "Ten miesiąc" : monthLabel(key)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {categories.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Pressable
              onPress={() => setCategory(null)}
              style={[styles.chip, { borderColor: surfaces.border }, !category && { borderColor: accent, backgroundColor: surfaces.surfaceStrong }]}
            >
              <Text style={[styles.chipText, !category && { color: accent }]}>Wszystkie kategorie</Text>
            </Pressable>
            {categories.map((item) => (
              <Pressable
                key={item}
                onPress={() => setCategory((current) => (current === item ? null : item))}
                style={[
                  styles.chip,
                  { borderColor: surfaces.border },
                  category === item && { borderColor: accent, backgroundColor: surfaces.surfaceStrong },
                ]}
              >
                <Text style={[styles.chipText, category === item && { color: accent }]}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      {receipts.length === 0 ? (
        <Text style={styles.empty}>
          Tu zbierają się zdjęcia paragonów. Dodaj pierwsze plusem na dole albo przy wydatku w Podsumowaniu.
        </Text>
      ) : data.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.empty}>Nic nie pasuje do filtrów.</Text>
          {filtersOn ? (
            <Pressable
              onPress={() => {
                setQuery("");
                setMonth(null);
                setCategory(null);
              }}
            >
              <Text style={[styles.clear, { color: accent }]}>Wyczyść filtry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setOpen(item)}
              onLongPress={() => confirmDelete(item.id)}
              style={[styles.card, { backgroundColor: surfaces.surface, borderColor: surfaces.border }]}
            >
              <Image source={{ uri: item.uri }} style={styles.image} />
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name || item.category}
              </Text>
              <Text style={[styles.meta, { color: accent }]} numberOfLines={2}>
                {formatDay(item.date)} · {formatPln(item.amount)}
              </Text>
            </Pressable>
          )}
        />
      )}

      <Pressable onPress={() => setAdding(true)} style={[styles.fab, { backgroundColor: accent }]}>
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </Pressable>

      <AddReceiptModal visible={adding} onClose={() => setAdding(false)} />
      <ReceiptPreviewModal
        receipt={open}
        onClose={() => setOpen(null)}
        onDelete={(id) => confirmDelete(id)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  toolbar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  search: {
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  chips: {
    gap: 8,
    paddingBottom: 8,
    paddingRight: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontFamily: "MontserratSemiBold",
    fontSize: 13,
    color: "#6b5f6a",
  },
  emptyWrap: { padding: 20 },
  empty: {
    fontFamily: "PoppinsRegular",
    fontSize: 14,
    color: "#6b5f6a",
    lineHeight: 20,
    padding: 20,
  },
  clear: {
    fontFamily: "MontserratSemiBold",
    fontSize: 15,
    paddingHorizontal: 20,
  },
  list: {
    padding: 12,
    paddingBottom: 96,
  },
  row: {
    gap: 10,
    marginBottom: 10,
  },
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    paddingBottom: 10,
  },
  image: {
    width: "100%",
    height: 150,
    backgroundColor: "#eadfe6",
  },
  cardTitle: {
    fontFamily: "MontserratSemiBold",
    fontSize: 14,
    color: "#1f1220",
    marginTop: 8,
    paddingHorizontal: 10,
  },
  meta: {
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    marginTop: 2,
    paddingHorizontal: 10,
  },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 22,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#1f1220",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});

export default ReceiptsIndexScreen;
