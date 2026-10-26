import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAccent } from "../contexts/ThemeContext";
import { TransactionType } from "../db/interfaces";
import { categoriesFor } from "../helpers/categories";

type CategoryPickerProps = {
  type: TransactionType;
  value: string;
  onChange: (category: string) => void;
};

export default function CategoryPicker({ type, value, onChange }: CategoryPickerProps) {
  const { accent, surfaces } = useAccent();
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Kategoria</Text>
      <View style={styles.grid}>
        {categoriesFor(type).map((category) => {
          const selected = category.label === value;
          return (
            <Pressable
              key={category.label}
              onPress={() => onChange(category.label)}
              style={[
                styles.card,
                { backgroundColor: surfaces.surface },
                selected && { borderColor: accent, backgroundColor: surfaces.surfaceStrong },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: selected ? accent : surfaces.surfaceStrong }]}>
                <MaterialCommunityIcons
                  name={category.icon}
                  size={22}
                  color={selected ? "#fff" : accent}
                />
              </View>
              <Text numberOfLines={1} style={[styles.cardText, selected && styles.cardTextSelected, selected && { color: accent }]}>
                {category.label}
              </Text>
              {selected ? (
                <MaterialCommunityIcons name="check-circle" size={16} color={accent} style={styles.check} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  label: {
    fontFamily: "MontserratSemiBold",
    fontSize: 13,
    color: "#6b5f6a",
    marginBottom: 10,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    width: "31%",
    minWidth: 96,
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  cardText: {
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    color: "#3d323c",
    textAlign: "center",
  },
  cardTextSelected: {
    fontFamily: "MontserratSemiBold",
  },
  check: {
    position: "absolute",
    top: 8,
    right: 8,
  },
});
