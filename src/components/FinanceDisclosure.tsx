import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAccent } from "../contexts/ThemeContext";

export function FinanceDisclosure({ title = "Założenia obliczeń", children }: { title?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { accent, surfaces } = useAccent();
  return <View style={[styles.root, { borderTopColor: surfaces.border }]}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={styles.trigger}>
      <Text style={[styles.label, { color: accent }]}>{title}</Text>
      <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={accent} />
    </Pressable>
    {open ? <View style={styles.body}>{children}</View> : null}
  </View>;
}
const styles = StyleSheet.create({
  root: { borderTopWidth: 1, marginTop: 4 },
  trigger: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  label: { fontFamily: "PoppinsRegular", fontSize: 12, flexShrink: 1 },
  body: { paddingBottom: 12 },
});
