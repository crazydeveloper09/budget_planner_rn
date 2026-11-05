import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAccent } from "../contexts/ThemeContext";

export const GOAL_CATEGORIES = [
  { label: "Wakacje", icon: "palm-tree" },
  { label: "Elektronika", icon: "laptop" },
  { label: "Samochód", icon: "car-outline" },
  { label: "Dom", icon: "home-outline" },
  { label: "Edukacja", icon: "school-outline" },
  { label: "Rezerwa", icon: "shield-check-outline" },
  { label: "Inne", icon: "bullseye-arrow" },
] as const;
export function goalCategoryIcon(category?: string) {
  return (GOAL_CATEGORIES.find(item => item.label === category) ?? GOAL_CATEGORIES[6]).icon;
}
export default function GoalCategoryPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { accent, surfaces } = useAccent();
  return <View style={styles.root}>
    <Text style={styles.heading}>Kategoria celu</Text>
    <View style={styles.list}>
      {GOAL_CATEGORIES.map(item => {
        const selected = value === item.label;
        return <Pressable key={item.label} accessibilityRole="radio" accessibilityLabel={item.label} accessibilityState={{ checked: selected }} onPress={() => onChange(item.label)} style={({ pressed }) => [styles.tile, { backgroundColor: selected ? surfaces.surfaceStrong : surfaces.surface, borderColor: selected ? accent : surfaces.border, opacity: pressed ? 0.75 : 1 }]}>
          {selected ? <View style={[styles.check, { backgroundColor: accent }]}><MaterialCommunityIcons name="check" size={11} color="#fff" /></View> : null}
          <View style={[styles.icon, { backgroundColor: selected ? accent : surfaces.surfaceStrong }]}><MaterialCommunityIcons name={item.icon} size={25} color={selected ? "#fff" : accent} /></View>
          <Text style={[styles.label, { color: selected ? accent : "#514452" }]}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { gap: 12, paddingVertical: 8 },
  heading: { fontFamily: "MontserratSemiBold", fontSize: 13, color: "#514452" },
  list: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "30%", flexGrow: 0, minWidth: 82, minHeight: 100, borderRadius: 16, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 12, alignItems: "center", justifyContent: "center", gap: 9 },
  icon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  check: { position: "absolute", right: 7, top: 7, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: "PoppinsRegular", fontSize: 11, textAlign: "center" },
});
