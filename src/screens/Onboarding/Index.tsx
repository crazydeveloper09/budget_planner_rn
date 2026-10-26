import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import PeopleEditor from "../../components/PeopleEditor";
import { apiErrorMessage } from "../../contexts/AuthContext";
import { useProfile } from "../../contexts/ProfileContext";
import { AccountType, NewMember } from "../../db/interfaces";
import { ACCOUNT_TYPES, getAccountTypeConfig } from "../../helpers/accountTypes";
import { useAccent } from "../../contexts/ThemeContext";

type OnboardingScreenProps = {
  onLoginPress: () => void;
};

const TYPE_PUNCH: Record<AccountType, string> = {
  personal: "Tylko Ty i Twoje liczby",
  family: "Jeden dach, jeden budżet",
  business: "Firma bez chaosu w Excelu",
};

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onLoginPress }) => {
  const { accent, surfaces } = useAccent();
  const navigation = useNavigation();
  const { completeOnboarding } = useProfile();

  const goLogin = () => {
    let current: { getState: () => unknown; navigate: (name: never) => void; getParent?: () => unknown } | undefined =
      navigation;
    while (current) {
      const names = (current.getState?.() as { routeNames?: string[] } | undefined)?.routeNames;
      if (names?.includes("Auth")) {
        current.navigate("Auth" as never);
        return;
      }
      current = current.getParent?.() as typeof current;
    }
    onLoginPress();
  };
  const [step, setStep] = useState<1 | 2>(1);
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [name, setName] = useState("");
  const [people, setPeople] = useState<NewMember[]>([]);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => getAccountTypeConfig(accountType), [accountType]);
  const trimmedName = name.trim();
  const needsPeople = accountType === "family" || accountType === "business";

  const onSelectType = (type: AccountType) => {
    setAccountType(type);
    setPeople([]);
  };

  const finish = async () => {
    setSaving(true);
    try {
      await completeOnboarding({
        name: trimmedName,
        accountType,
        members: needsPeople ? people : [],
      });
    } catch (error) {
      Alert.alert("Nie udało się", apiErrorMessage(error, "Nie zapisano profilu."));
    } finally {
      setSaving(false);
    }
  };

  const onContinue = async () => {
    if (saving) return;
    if (trimmedName.length < 2) {
      Alert.alert("Jeszcze imię", `Uzupełnij pole „${selected.nameLabel}”.`);
      return;
    }
    if (needsPeople && step === 1) {
      setStep(2);
      return;
    }
    await finish();
  };

  const heroTitle =
    step === 1
      ? "Pieniądze lubią porządek"
      : accountType === "family"
        ? "Kto dzieli ten dach?"
        : "Kto kręci firmą?";
  const heroDeck =
    step === 1
      ? "Wybierz tempo: sam, z rodziną albo z zespołem. Na razie wszystko zostaje w telefonie."
      : accountType === "family"
        ? "Dodaj bliskich z imieniem i dziennym saldem. Zaprosisz ich do apki później."
        : "Lista pracowników i wypłat. Edytujesz to w każdej chwili.";

  return (
    <View style={[styles.root, { backgroundColor: accent }]}>
      <SafeAreaView style={styles.flex} edges={["top"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.hero}>
              <View pointerEvents="none" style={[styles.blob, styles.blobOne]} />
              <View pointerEvents="none" style={[styles.blob, styles.blobTwo]} />
              {step === 2 ? (
                <Pressable onPress={() => setStep(1)} style={styles.backBtn} hitSlop={8}>
                  <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
                </Pressable>
              ) : (
                <View style={styles.heroIcon}>
                  <MaterialCommunityIcons name="wallet-outline" size={30} color="#fff" />
                </View>
              )}
              <Text style={styles.script}>Budget Planner</Text>
              <Text style={styles.heroTitle}>{heroTitle}</Text>
              <Text style={styles.heroDeck}>{heroDeck}</Text>
              {step === 1 ? (
                <Pressable onPress={goLogin} style={styles.loginPill} hitSlop={8}>
                  <MaterialCommunityIcons name="login" size={16} color="#fff" />
                  <Text style={styles.loginPillText}>Mam już konto — zaloguj mnie</Text>
                </Pressable>
              ) : (
                <Text style={styles.stepMark}>Krok 2 z 2 · {selected.title}</Text>
              )}
            </View>

            <View style={styles.sheet}>
              {step === 1 ? (
                <>
                  <Text style={styles.sectionLabel}>Jak liczysz?</Text>
                  <View style={styles.cards}>
                    {ACCOUNT_TYPES.map((item) => {
                      const isSelected = item.type === accountType;
                      return (
                        <Pressable
                          key={item.type}
                          onPress={() => onSelectType(item.type)}
                          style={[
                            styles.card,
                            { backgroundColor: surfaces.surface, borderColor: "transparent" },
                            isSelected && {
                              borderColor: accent,
                              backgroundColor: surfaces.surfaceStrong,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.iconWrap,
                              { backgroundColor: isSelected ? accent : surfaces.surfaceStrong },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={item.icon}
                              size={26}
                              color={isSelected ? "#fff" : accent}
                            />
                          </View>
                          <View style={styles.cardCopy}>
                            <Text style={[styles.cardTitle, isSelected && { color: accent }]}>
                              {item.title}
                            </Text>
                            <Text style={styles.cardPunch}>{TYPE_PUNCH[item.type]}</Text>
                          </View>
                          {isSelected ? (
                            <MaterialCommunityIcons name="check-circle" size={22} color={accent} />
                          ) : (
                            <View style={[styles.radio, { borderColor: surfaces.border }]} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.sectionLabel}>{selected.nameLabel}</Text>
                  <TextInput
                    mode="outlined"
                    label={selected.nameLabel}
                    placeholder={selected.namePlaceholder}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    left={
                      <TextInput.Icon
                        icon={accountType === "family" ? "home-heart" : accountType === "business" ? "office-building" : "account"}
                        color={accent}
                      />
                    }
                    style={styles.input}
                    outlineColor={surfaces.border}
                    activeOutlineColor={accent}
                    outlineStyle={styles.outline}
                  />
                </>
              ) : (
                <PeopleEditor
                  accountType={accountType}
                  people={people}
                  onAdd={(person) => setPeople((current) => [...current, person])}
                  onRemove={(index) =>
                    setPeople((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                />
              )}

              <Pressable
                onPress={() => {
                  void onContinue();
                }}
                disabled={saving}
                style={[styles.cta, { backgroundColor: accent, opacity: saving ? 0.7 : 1 }]}
              >
                <Text style={styles.ctaText}>
                  {saving ? "Zapisuję…" : needsPeople && step === 1 ? "Dalej, do ludzi" : "Zaczynamy liczyć"}
                </Text>
                <MaterialCommunityIcons
                  name={needsPeople && step === 1 ? "arrow-right" : "check"}
                  size={20}
                  color="#fff"
                />
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  hero: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 36,
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
  },
  blobOne: {
    width: 220,
    height: 220,
    top: -70,
    right: -80,
  },
  blobTwo: {
    width: 120,
    height: 120,
    bottom: 10,
    left: -40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  script: {
    fontFamily: "SatisfyRegular",
    fontSize: 22,
    color: "rgba(255,255,255,0.88)",
    marginBottom: 6,
  },
  heroTitle: {
    fontFamily: "MontserratSemiBold",
    fontSize: 30,
    lineHeight: 36,
    color: "#fff",
    marginBottom: 8,
    maxWidth: 320,
  },
  heroDeck: {
    fontFamily: "PoppinsRegular",
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.82)",
    maxWidth: 320,
  },
  loginPill: {
    alignSelf: "flex-start",
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  loginPillText: {
    fontFamily: "MontserratSemiBold",
    fontSize: 13,
    color: "#fff",
  },
  stepMark: {
    fontFamily: "MontserratSemiBold",
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 14,
    letterSpacing: 0.4,
  },
  sheet: {
    flexGrow: 1,
    backgroundColor: "#fff8fb",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 36,
    marginTop: -12,
  },
  sectionLabel: {
    fontFamily: "MontserratSemiBold",
    fontSize: 13,
    color: "#6b5f6a",
    marginBottom: 10,
  },
  cards: {
    gap: 10,
    marginBottom: 22,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardCopy: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: "MontserratSemiBold",
    fontSize: 16,
    color: "#1f1220",
  },
  cardPunch: {
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    color: "#6b5f6a",
    marginTop: 2,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
  },
  input: {
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  outline: {
    borderRadius: 14,
  },
  cta: {
    marginTop: 18,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ctaText: {
    fontFamily: "MontserratSemiBold",
    fontSize: 16,
    color: "#fff",
  },
});

export default OnboardingScreen;
