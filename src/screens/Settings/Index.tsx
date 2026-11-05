import React, { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useNavigation } from "@react-navigation/native";
import { apiErrorMessage, useAuth } from "../../contexts/AuthContext";
import { useProfile } from "../../contexts/ProfileContext";
import { useAccent } from "../../contexts/ThemeContext";
import { AccountType } from "../../db/interfaces";
import { ACCOUNT_TYPES, getAccountTypeConfig } from "../../helpers/accountTypes";
import { ACCENT_PALETTE } from "../../helpers/colors";
import { parseAmount } from "../../helpers/money";
import {
  BUY_ME_A_COFFEE_URL,
  CREATOR_NAME,
  supportMailto,
} from "../../helpers/support";

const SettingsIndexScreen: React.FC = () => {
  const { accent, surfaces, setAccent } = useAccent();
  const navigation = useNavigation();
  const { user, household, cloudMembers, logout, createHousehold, profileHasCloud } = useAuth();
  const { profile, profiles, switchAccount, addAccount } = useProfile();
  const [cloudFlags, setCloudFlags] = useState<Record<number, boolean>>({});
  const [addingType, setAddingType] = useState<AccountType | null>(null);
  const [newName, setNewName] = useState("");
  const [newWallet, setNewWallet] = useState("");
  const [saving, setSaving] = useState(false);
  const adding = addingType ? getAccountTypeConfig(addingType) : null;
  const byType = useMemo(
    () => Object.fromEntries(profiles.map((item) => [item.accountType, item])) as Partial<
      Record<AccountType, (typeof profiles)[number]>
    >,
    [profiles]
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all(profiles.map(async (item) => [item.id, await profileHasCloud(item.id)] as const)).then(
      (rows) => {
        if (!cancelled) setCloudFlags(Object.fromEntries(rows));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [profileHasCloud, profiles, user?.id]);

  const activeType = profile ? getAccountTypeConfig(profile.accountType).title : "konto";
  const version = Constants.expoConfig?.version ?? "1.0.0";

  const openUrl = (url: string) => {
    void Linking.openURL(url).catch(() => {
      Alert.alert("Nie udało się otworzyć", url);
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Chmura · {activeType}</Text>
      {user ? (
      <Text style={styles.subtitle}>
        {user.username}
        {user.role === "owner"
          ? " · konto główne"
          : household?.accountType === "business"
            ? " · pracownik"
            : " · członek rodziny"}
        {"\n"}Sesja należy do aktywnego budżetu. Inne typy logujesz osobno po przełączeniu.
      </Text>
      ) : (
      <Text style={styles.subtitle}>
        To konto nie jest jeszcze w chmurze. Zaloguj się albo załóż nowe — synchronizacja dotyczy tylko aktywnego typu.
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
        Zaloguj się / załóż konto
      </Button>
      )}

      <>
          <Text style={[styles.title, styles.colorTitle]}>Typ konta</Text>
          <Text style={styles.subtitle}>
            Każdy typ to osobny budżet. Po przełączeniu możesz zalogować albo zarejestrować chmurę właśnie dla niego.
          </Text>
          <View style={styles.accountCards}>
            {ACCOUNT_TYPES.map((item) => {
              const existing = byType[item.type];
              const selected = profile?.id === existing?.id;
              return (
                <Pressable
                  key={item.type}
                  onPress={() => {
                    if (existing) {
                      setAddingType(null);
                      if (!selected) void switchAccount(existing.id);
                      return;
                    }
                    setAddingType(item.type);
                    setNewName("");
                    setNewWallet("");
                  }}
                  style={[
                    styles.accountCard,
                    { backgroundColor: surfaces.surface, borderColor: surfaces.border },
                    selected && { borderColor: accent, backgroundColor: surfaces.surfaceStrong },
                  ]}
                >
                  <View style={[styles.accountIcon, { backgroundColor: selected ? accent : surfaces.surfaceStrong }]}>
                    <MaterialCommunityIcons name={item.icon} size={22} color={selected ? "#fff" : accent} />
                  </View>
                  <View style={styles.accountCopy}>
                    <Text style={[styles.accountTitle, selected && { color: accent }]}>{item.title}</Text>
                    <Text style={styles.accountMeta}>
                      {existing
                        ? `${selected ? "Aktywne" : "Przełącz"} · ${existing.name}${
                            cloudFlags[existing.id] ? " · chmura" : " · tylko telefon"
                          }`
                        : "Dodaj ten typ konta"}
                    </Text>
                  </View>
                  {selected ? (
                    <MaterialCommunityIcons name="check-circle" size={22} color={accent} />
                  ) : (
                    <MaterialCommunityIcons
                      name={existing ? "swap-horizontal" : "plus-circle-outline"}
                      size={22}
                      color={accent}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
          {adding ? (
            <View style={styles.addBox}>
              <Text style={styles.addTitle}>Nowe {adding.title.toLowerCase()}</Text>
              <TextInput
                mode="outlined"
                label={adding.nameLabel}
                placeholder={adding.namePlaceholder}
                value={newName}
                onChangeText={setNewName}
                style={styles.input}
                outlineColor={surfaces.border}
                activeOutlineColor={accent}
              />
              <TextInput
                mode="outlined"
                label="Ile masz teraz na koncie"
                placeholder="np. 2450"
                value={newWallet}
                onChangeText={setNewWallet}
                keyboardType="decimal-pad"
                style={styles.input}
                outlineColor={surfaces.border}
                activeOutlineColor={accent}
              />
              <Button
                mode="contained"
                buttonColor={accent}
                textColor="#fff"
                style={styles.logout}
                disabled={saving}
                onPress={() => {
                  const walletBalance = parseAmount(newWallet);
                  if (newName.trim().length < 2) {
                    Alert.alert("Nazwa", `Uzupełnij pole „${adding.nameLabel}”.`);
                    return;
                  }
                  if (walletBalance === null) {
                    Alert.alert("Stan konta", "Podaj aktualny stan konta. Zero też wchodzi.");
                    return;
                  }
                  setSaving(true);
                  void addAccount({
                    name: newName.trim(),
                    accountType: adding.type,
                    walletBalance,
                  })
                    .then(() => {
                      setAddingType(null);
                      setNewWallet("");
                    })
                    .catch((error) => {
                      Alert.alert("Nie udało się", apiErrorMessage(error, "Nie utworzono konta."));
                    })
                    .finally(() => setSaving(false));
                }}
              >
                Utwórz i przełącz
              </Button>
              <Button mode="text" textColor={accent} onPress={() => setAddingType(null)}>
                Anuluj
              </Button>
            </View>
          ) : null}
      </>

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

      <Text style={[styles.title, styles.helpTitle]}>Pomoc i informacje</Text>
      <View style={styles.accountCards}>
        <Pressable
          onPress={() =>
            openUrl(
              supportMailto(
                "Zgłoszenie uwagi — Budget Planner",
                `Cześć,\n\nChcę zgłosić uwagę do Budget Planner (wersja ${version}):\n\n`
              )
            )
          }
          style={[styles.accountCard, { backgroundColor: surfaces.surface, borderColor: surfaces.border }]}
        >
          <View style={[styles.accountIcon, { backgroundColor: surfaces.surfaceStrong }]}>
            <MaterialCommunityIcons name="message-alert-outline" size={22} color={accent} />
          </View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountTitle}>Zgłoś uwagę</Text>
            <Text style={styles.accountMeta}>Napisz, jeśli coś nie działa</Text>
          </View>
          <MaterialCommunityIcons name="open-in-new" size={20} color={accent} />
        </Pressable>
        <Pressable
          onPress={() =>
            openUrl(
              supportMailto(
                "Pomysł na ulepszenie — Budget Planner",
                `Cześć,\n\nMam pomysł na ulepszenie Budget Planner (wersja ${version}):\n\n`
              )
            )
          }
          style={[styles.accountCard, { backgroundColor: surfaces.surface, borderColor: surfaces.border }]}
        >
          <View style={[styles.accountIcon, { backgroundColor: surfaces.surfaceStrong }]}>
            <MaterialCommunityIcons name="lightbulb-outline" size={22} color={accent} />
          </View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountTitle}>Pomysł na ulepszenie</Text>
            <Text style={styles.accountMeta}>Napisz, czego brakuje</Text>
          </View>
          <MaterialCommunityIcons name="open-in-new" size={20} color={accent} />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate("Privacy" as never)}
          style={[styles.accountCard, { backgroundColor: surfaces.surface, borderColor: surfaces.border }]}
        >
          <View style={[styles.accountIcon, { backgroundColor: surfaces.surfaceStrong }]}>
            <MaterialCommunityIcons name="shield-account-outline" size={22} color={accent} />
          </View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountTitle}>Polityka prywatności</Text>
            <Text style={styles.accountMeta}>Jak przetwarzamy dane</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={accent} />
        </Pressable>
        <Pressable
          onPress={() => openUrl(BUY_ME_A_COFFEE_URL)}
          style={[styles.accountCard, { backgroundColor: surfaces.surface, borderColor: surfaces.border }]}
        >
          <View style={[styles.accountIcon, { backgroundColor: surfaces.surfaceStrong }]}>
            <MaterialCommunityIcons name="coffee-outline" size={22} color={accent} />
          </View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountTitle}>Postaw kawę</Text>
            <Text style={styles.accountMeta}>Buy Me a Coffee</Text>
          </View>
          <MaterialCommunityIcons name="open-in-new" size={20} color={accent} />
        </Pressable>
      </View>

      <View style={styles.about}>
        <Text style={styles.version}>Wersja {version}</Text>
        <View style={[styles.aboutDivider, { backgroundColor: surfaces.border }]} />
        <Text style={styles.credit}>Stworzone z ❤️ przez {CREATOR_NAME}</Text>
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
    paddingBottom: 140,
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
  helpTitle: {
    marginTop: 48,
    marginBottom: 16,
  },
  accountCards: {
    gap: 10,
    marginBottom: 8,
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
  },
  accountIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  accountCopy: {
    flex: 1,
  },
  accountTitle: {
    fontFamily: "MontserratSemiBold",
    fontSize: 16,
    color: "#1f1220",
  },
  accountMeta: {
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    color: "#6b5f6a",
    marginTop: 2,
  },
  addBox: {
    marginTop: 8,
    marginBottom: 8,
  },
  addTitle: {
    fontFamily: "MontserratSemiBold",
    fontSize: 15,
    color: "#1f1220",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#fff",
    marginBottom: 10,
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
  about: {
    marginTop: 28,
    marginBottom: 0,
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 0,
  },
  version: {
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    color: "#6b5f6a",
    letterSpacing: 0.3,
  },
  aboutDivider: {
    width: 40,
    height: 2,
    borderRadius: 99,
    marginVertical: 10,
  },
  credit: {
    fontFamily: "MontserratSemiBold",
    fontSize: 14,
    color: "#1f1220",
    textAlign: "center",
    lineHeight: 20,
  },
});

export default SettingsIndexScreen;
