import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useAccent } from "../contexts/ThemeContext";
import { goalPriority } from "../helpers/goalAllocation";
import tinycolor from "tinycolor2";

export default function GoalPriorityPicker({ value, onChange }: { value?: number; onChange: (value: number) => void }) {
  const { accent } = useAccent();
  const light = tinycolor.mix(accent, "#ffffff", 95).toHexString();
  const border = tinycolor.mix(accent, "#ffffff", 82).toHexString();
  return <View style={styles.root}>
    <Text style={styles.title}>Priorytet oszczędzania</Text>
    <View style={styles.options}>{[{ value: 3, label: "Wysoki" }, { value: 2, label: "Standardowy" }, { value: 1, label: "Niski" }].map(item => <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: goalPriority(value) === item.value }} onPress={() => onChange(item.value)} style={[styles.option, { backgroundColor: goalPriority(value) === item.value ? accent : light, borderColor: goalPriority(value) === item.value ? accent : border }]}><Text style={[styles.label, { color: goalPriority(value) === item.value ? "#fff" : "#514452" }]}>{item.label}</Text></Pressable>)}</View>
    <View style={[styles.note, { backgroundColor: light }]}><Text style={styles.hint}>Wyższy priorytet otrzymuje nadwyżki jako pierwszy. Przy remisie decyduje kolejność dodania. Zmiana przeliczy podział szacowanych oszczędności.</Text></View>
  </View>;
}
const styles = StyleSheet.create({ root: { gap: 10, paddingVertical: 8 }, title: { fontFamily: "MontserratSemiBold", fontSize: 13, color: "#514452" }, options: { flexDirection: "row", gap: 7 }, option: { flex: 1, borderRadius: 12, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 12, alignItems: "center" }, label: { fontFamily: "PoppinsRegular", fontSize: 11 }, note: { borderRadius: 12, padding: 12 }, hint: { fontFamily: "PoppinsRegular", fontSize: 11, lineHeight: 18, color: "#6b5f6a" } });
