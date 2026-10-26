import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { apiErrorMessage, useAuth } from "../../contexts/AuthContext";
import { useProfile } from "../../contexts/ProfileContext";
import { useAccent } from "../../contexts/ThemeContext";
import { ACCENT_PALETTE } from "../../helpers/colors";

const SettingsIndexScreen: React.FC = () => {
  const { accent, setAccent } = useAccent();
  const navigation = useNavigation();
  const { user, household, cloudMembers, logout, createHousehold } = useAuth();
  const { profile } = useProfile();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Konto w chmurze</Text>
      {user ? (
      <Text style={styles.subtitle}>
        {user.username}
        {user.role === "owner" ? " · konto główne" : " · członek rodziny"}
      </Text>
      ) : (
      <Text style={styles.subtitle}>
        Opcjonalne. Zaloguj się, jeśli masz konto na innym urządzeniu albo kod zaproszenia do rodziny.
      </Text>
      )}
      {household ? (
        <>
          <Text style={styles.meta}>{household.name}</Text>
          <Text style={styles.e2eNote}>
            Budżet w chmurze jest szyfrowany na telefonie (E2E). Serwer przechowuje tylko szyfrogram — bez kwot i
            nazw wpisów.
          </Text>
        </>
      ) : user?.role === "owner" && profile ? (
        <Button
          mode="contained"
          buttonColor={accent}
          textColor="#fff"
          style={styles.logout}
          onPress={() => {
            void createHousehold({
              name: profile.name,
              accountType: profile.accountType,
            }).catch((error) => {
              Alert.alert("Nie udało się", apiErrorMessage(error, "Nie powiązano budżetu z chmurą."));
            });
          }}
        >
          Powiąż budżet z chmurą
        </Button>
      ) : null}
      {cloudMembers.length > 0 ? (
        <View style={styles.members}>
          {cloudMembers.map((member) => (
            <Text key={member.id} style={styles.memberLine}>
              {member.displayName} ({member.username})
              {member.role === "owner" ? " · główne" : ""}
            </Text>
          ))}
        </View>
      ) : null}
      {user ? (
      <Button
        mode="outlined"
        textColor={accent}
        style={[styles.logout, { borderColor: accent }]}
        onPress={() => void logout()}
      >
        Wyloguj
      </Button>
      ) : (
      <Button
        mode="contained"
        buttonColor={accent}
        textColor="#fff"
        style={styles.logout}
        onPress={() => navigation.navigate("Auth" as never)}
      >
        Zaloguj się
      </Button>
      )}

      <Text style={[styles.title, styles.colorTitle]}>Kolor aplikacji</Text>
      <Text style={styles.subtitle}>
        Wybierz główny kolor. Zmieni się nagłówek, przyciski i akcenty w całej apce.
      </Text>
      <View style={styles.grid}>
        {ACCENT_PALETTE.map((item) => {
          const selected = item.hex === accent;
          return (
            <Pressable
              key={item.hex}
              onPress={() => {
                void setAccent(item.hex);
              }}
              style={styles.swatchWrap}
            >
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: item.hex },
                  selected && styles.swatchSelected,
                ]}
              >
                {selected ? (
                  <MaterialCommunityIcons name="check" size={22} color="#fff" />
                ) : null}
              </View>
              <Text style={[styles.swatchLabel, selected && { color: item.hex, fontFamily: "MontserratSemiBold" }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
    paddingBottom: 32,
  },
  title: {
    fontFamily: "MontserratSemiBold",
    fontSize: 22,
    color: "#1f1220",
  },
  subtitle: {
    fontFamily: "PoppinsRegular",
    fontSize: 14,
    color: "#6b5f6a",
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 20,
  },
  meta: {
    fontFamily: "PoppinsRegular",
    fontSize: 14,
    color: "#1f1220",
    marginTop: -12,
    marginBottom: 8,
  },
  e2eNote: {
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    color: "#6b5f6a",
    lineHeight: 19,
    marginBottom: 12,
  },
  members: {
    marginBottom: 8,
    gap: 4,
  },
  memberLine: {
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    color: "#5c5160",
  },
  logout: {
    borderRadius: 12,
    marginBottom: 8,
  },
  colorTitle: {
    marginTop: 28,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  swatchWrap: {
    width: "25%",
    alignItems: "center",
    marginBottom: 18,
  },
  swatch: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "transparent",
  },
  swatchSelected: {
    borderColor: "#1f1220",
  },
  swatchLabel: {
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    color: "#5c5160",
    marginTop: 8,
    textAlign: "center",
  },
});

export default SettingsIndexScreen;
