import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAccent } from "../contexts/ThemeContext";
import { Member } from "../db/interfaces";
import { SHARED_OWNER_ID } from "../helpers/owners";

type OwnerPickerProps = {
  members: Member[];
  value: number | null;
  onChange: (memberId: number | null) => void;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function OwnerPicker({ members, value, onChange }: OwnerPickerProps) {
  const { accent, surfaces } = useAccent();
  const selected = value ?? SHARED_OWNER_ID;

  if (members.length === 0) {
    return null;
  }

  const options = [
    { id: SHARED_OWNER_ID, label: "Wspólny", hint: "Cała rodzina", kind: "shared" as const },
    ...members.map((member) => ({
      id: member.id,
      label: member.name,
      hint: "Członek rodziny",
      kind: "person" as const,
    })),
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Dla kogo</Text>
      <View style={styles.list}>
        {options.map((option) => {
          const isSelected = option.id === selected;
          return (
            <Pressable
              key={option.id}
              onPress={() => onChange(option.id === SHARED_OWNER_ID ? null : option.id)}
              style={[
                styles.card,
                { backgroundColor: surfaces.surface },
                isSelected && { borderColor: accent, backgroundColor: surfaces.surfaceStrong },
              ]}
            >
              {option.kind === "shared" ? (
                <View style={[styles.avatar, { backgroundColor: isSelected ? accent : surfaces.surfaceStrong }]}>
                  <MaterialCommunityIcons
                    name="home-heart"
                    size={22}
                    color={isSelected ? "#fff" : accent}
                  />
                </View>
              ) : (
                <View style={[styles.avatar, { backgroundColor: isSelected ? accent : surfaces.surfaceStrong }]}>
                  <Text style={[styles.initials, { color: isSelected ? "#fff" : accent }]}>
                    {initials(option.label)}
                  </Text>
                </View>
              )}
              <View style={styles.copy}>
                <Text numberOfLines={1} style={[styles.name, isSelected && { color: accent }]}>
                  {option.label}
                </Text>
                <Text numberOfLines={1} style={styles.hint}>
                  {option.hint}
                </Text>
              </View>
              {isSelected ? (
                <MaterialCommunityIcons name="check-circle" size={20} color={accent} />
              ) : (
                <View style={[styles.radio, { borderColor: surfaces.border }]} />
              )}
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
  list: {
    gap: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: "MontserratSemiBold",
    fontSize: 14,
  },
  copy: {
    flex: 1,
  },
  name: {
    fontFamily: "MontserratSemiBold",
    fontSize: 15,
    color: "#1f1220",
  },
  hint: {
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    color: "#6b5f6a",
    marginTop: 1,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
  },
});
