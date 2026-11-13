import React, { useCallback, useState } from "react";
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, IconButton, Searchbar, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAccent } from "../contexts/ThemeContext";
import { getCategoryOption } from "../helpers/categories";
import { readShops, Shop, shopGroups } from "../helpers/shops";

export default function ShopPicker({ profileId, selected, onSelect }: {
  profileId: number;
  selected: Shop | null;
  onSelect: (shop: Shop | null) => void;
}) {
  const { accent, surfaces } = useAccent();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<{ profileId: number; shops: Shop[] } | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    void readShops(profileId).then(shops => {
      if (active) setCatalog({ profileId, shops });
    }).catch(console.warn);
    return () => { active = false; };
  }, [profileId]));

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const searching = Boolean(query.trim());
  const groups = shopGroups(catalog?.profileId === profileId ? catalog.shops : [], query);

  return (
    <>
      <Pressable
        style={[styles.card, styles.row, { borderColor: surfaces.border, backgroundColor: surfaces.surface }]}
        accessibilityRole="button"
        onPress={() => {
          Keyboard.dismiss();
          setExpanded(selected?.category ?? null);
          setOpen(true);
        }}
      >
        <View style={[styles.icon, { backgroundColor: surfaces.surfaceStrong }]}>
          <MaterialCommunityIcons name="store-outline" size={22} color={accent} />
        </View>
        <Text style={styles.label}>{selected?.name ?? "Wybierz sklep (opcjonalnie)"}</Text>
        <MaterialCommunityIcons name="chevron-right" size={22} color={accent} />
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
        <SafeAreaView style={[styles.screen, { backgroundColor: surfaces.surface }]}>
          <View style={styles.header}>
            <Text variant="headlineSmall" accessibilityRole="header" style={styles.title}>Wybierz sklep</Text>
            <IconButton icon="close" mode="contained-tonal" accessibilityLabel="Zamknij listę sklepów" onPress={close} />
          </View>
          <Searchbar
            style={[styles.search, { backgroundColor: surfaces.surfaceStrong }]}
            placeholder="Szukaj sklepu"
            accessibilityLabel="Szukaj sklepu"
            value={query}
            onChangeText={value => {
              setQuery(value);
              if (Boolean(value.trim()) !== searching) setExpanded(null);
            }}
          />
          <ScrollView contentContainerStyle={styles.groups} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            {selected && <Button onPress={() => onSelect(null)}>Usuń wybór sklepu</Button>}
            {!groups.length && <Text style={styles.empty}>Nie znaleziono sklepów.</Text>}
            {groups.map(({ category, names }) => {
              const isExpanded = searching ? expanded !== category : expanded === category;
              const icon = getCategoryOption(category, "expense")?.icon ?? "store-outline";
              return (
                <View key={category} style={[styles.card, { borderColor: surfaces.border }]}>
                  <Pressable
                    style={styles.row}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isExpanded }}
                    onPress={() => setExpanded(current => current === category ? null : category)}
                  >
                    <View style={[styles.icon, { backgroundColor: surfaces.surfaceStrong }]}>
                      <MaterialCommunityIcons name={icon} size={22} color={accent} />
                    </View>
                    <Text style={styles.label}>{category}</Text>
                    <MaterialCommunityIcons name={isExpanded ? "chevron-up" : "chevron-down"} size={22} color={accent} />
                  </Pressable>
                  {isExpanded && names.map(name => {
                    const checked = selected?.name === name && selected.category === category;
                    return (
                      <Pressable
                        key={name}
                        style={[styles.shopRow, { borderTopColor: surfaces.border }, checked && { backgroundColor: surfaces.surfaceStrong }]}
                        accessibilityRole="radio"
                        accessibilityState={{ checked }}
                        onPress={() => onSelect({ name, category })}
                      >
                        <Text style={styles.shopName}>{name}</Text>
                        {checked && <MaterialCommunityIcons name="check-circle" size={20} color={accent} />}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8 },
  title: { fontFamily: "MontserratSemiBold" },
  search: { marginHorizontal: 20, marginTop: 10, marginBottom: 8 },
  groups: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 10 },
  card: { borderRadius: 16, borderWidth: 1, backgroundColor: "#fff", overflow: "hidden" },
  row: { minHeight: 62, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, fontFamily: "MontserratSemiBold" },
  shopRow: { minHeight: 48, flexDirection: "row", alignItems: "center", paddingLeft: 62, paddingRight: 14, borderTopWidth: StyleSheet.hairlineWidth },
  shopName: { flex: 1 },
  empty: { paddingVertical: 16, textAlign: "center" },
});
