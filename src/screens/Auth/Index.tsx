import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput as NativeInput,
  View,
} from "react-native";
import { Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { apiErrorMessage, useAuth } from "../../contexts/AuthContext";
import { useAccent } from "../../contexts/ThemeContext";
import { TotpSetup } from "../../api/types";

type Mode = "login" | "register";
type Step = "credentials" | "setup" | "verify";

type AuthScreenProps = {
  onCancel?: () => void;
};

const AuthScreen: React.FC<AuthScreenProps> = ({ onCancel }) => {
  const { accent, surfaces } = useAccent();
  const navigation = useNavigation();
  const { user, login, register, confirmSetup, verifyLogin } = useAuth();
  const otpRef = useRef<NativeInput>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [code, setCode] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [totp, setTotp] = useState<TotpSetup | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  const openedWithUser = useRef(Boolean(user));

  const close = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  useEffect(() => {
    if (user && !openedWithUser.current) close();
  }, [user]);

  const goMode = (next: Mode) => {
    setMode(next);
    setStep("credentials");
    setCode("");
    setTotp(null);
    setSetupToken("");
    setChallengeToken("");
    setKeyCopied(false);
  };

  const submitCredentials = async () => {
    if (busy) return;
    const trimmedUser = username.trim();
    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim();
    const pass = password.trim();
    const passRepeat = passwordConfirm.trim();

    if (mode === "register") {
      if (trimmedName.length < 2) {
        Alert.alert("Uzupełnij dane", "Podaj imię.");
        return;
      }
      if (trimmedUser.length < 3) {
        Alert.alert("Uzupełnij dane", "Nazwa użytkownika musi mieć co najmniej 3 znaki.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        Alert.alert("Uzupełnij dane", "Podaj prawidłowy adres e-mail.");
        return;
      }
      if (pass.length < 8) {
        Alert.alert("Uzupełnij dane", "Hasło musi mieć co najmniej 8 znaków.");
        return;
      }
      if (pass !== passRepeat) {
        Alert.alert("Uzupełnij dane", "Hasła nie są takie same.");
        return;
      }
    } else if (trimmedUser.length < 3 || pass.length < 8) {
      Alert.alert("Uzupełnij dane", "Podaj nazwę użytkownika i hasło (min. 8 znaków).");
      return;
    }

    setBusy(true);
    try {
      if (mode === "register") {
        const result = await register({
          username: trimmedUser,
          password: pass,
          passwordConfirm: passRepeat,
          email: trimmedEmail,
          displayName: trimmedName,
          inviteCode: inviteCode.trim() || undefined,
        });
        setSetupToken(result.setupToken);
        setTotp(result.totp);
        setStep("setup");
      } else {
        const result = await login({ username: trimmedUser, password: pass });
        if (result.requiresSetup) {
          setSetupToken(result.setupToken);
          setTotp(result.totp);
          setStep("setup");
        } else {
          setChallengeToken(result.challengeToken);
          setStep("verify");
        }
      }
    } catch (error) {
      Alert.alert("Nie udało się", apiErrorMessage(error, "Sprawdź dane i połączenie z serwerem."));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    setBusy(true);
    try {
      if (step === "setup") {
        await confirmSetup({
          setupToken,
          code,
          password: password.trim(),
          inviteCode: inviteCode.trim() || undefined,
        });
      } else {
        await verifyLogin({ challengeToken, code, password: password.trim() });
      }
    } catch (error) {
      Alert.alert("Nie udało się", apiErrorMessage(error, "Nieprawidłowy kod 2FA."));
    } finally {
      setBusy(false);
    }
  };

  const passwordsMatch = password.trim() === passwordConfirm.trim();
  const canSubmitCode = /^\d{6}$/.test(code) && !busy;

  const headline =
    step === "setup"
      ? "Zamek na budżet"
      : step === "verify"
        ? "Sześć cyfr i jesteś w środku"
        : mode === "login"
          ? "Wejdź do swoich liczb"
          : "Nowe konto, ten sam spokój";

  const deck =
    step === "setup"
      ? "Zeskanuj kod aplikacją Authenticator. Potem ten zamek otworzy tylko Twój telefon."
      : step === "verify"
        ? "Kod zmienia się co 30 sekund. Wpisz ten, który widzisz teraz."
        : mode === "login"
          ? "Jedno hasło i 2FA — dla Ciebie i dla rodziny."
          : "Załóż konto albo wejdź kodem zaproszenia do rodzinnego budżetu.";

  const iconName =
    step === "setup" || step === "verify" ? "shield-key-outline" : mode === "login" ? "key-variant" : "cloud-outline";

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
              <View style={[styles.blob, styles.blobOne]} />
              <View style={[styles.blob, styles.blobTwo]} />
              <Pressable onPress={close} style={styles.backBtn} hitSlop={8}>
                <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" />
              </Pressable>
              <View style={styles.heroIcon}>
                <MaterialCommunityIcons name={iconName} size={30} color="#fff" />
              </View>
              <Text style={styles.script}>Budget Planner</Text>
              <Text style={styles.heroTitle}>{headline}</Text>
              <Text style={styles.heroDeck}>{deck}</Text>
            </View>

            <View style={[styles.sheet, { backgroundColor: "#fff8fb" }]}>
              {step === "credentials" ? (
                <>
                  <View style={[styles.segment, { backgroundColor: surfaces.surfaceStrong }]}>
                    <Pressable
                      onPress={() => goMode("login")}
                      style={[styles.segmentItem, mode === "login" && { backgroundColor: accent }]}
                    >
                      <Text style={[styles.segmentText, mode === "login" && styles.segmentTextOn]}>
                        Logowanie
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => goMode("register")}
                      style={[styles.segmentItem, mode === "register" && { backgroundColor: accent }]}
                    >
                      <Text style={[styles.segmentText, mode === "register" && styles.segmentTextOn]}>
                        Nowe konto
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.fieldBlock}>
                    {mode === "register" ? (
                      <TextInput
                        mode="outlined"
                        label="Imię"
                        value={displayName}
                        onChangeText={setDisplayName}
                        autoCapitalize="words"
                        left={<TextInput.Icon icon="flower-outline" color={accent} />}
                        style={styles.input}
                        outlineColor={surfaces.border}
                        activeOutlineColor={accent}
                        outlineStyle={styles.outline}
                      />
                    ) : null}
                    <TextInput
                      mode="outlined"
                      label="Nazwa użytkownika"
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                      left={<TextInput.Icon icon="account-outline" color={accent} />}
                      style={styles.input}
                      outlineColor={surfaces.border}
                      activeOutlineColor={accent}
                      outlineStyle={styles.outline}
                    />
                    {mode === "register" ? (
                      <TextInput
                        mode="outlined"
                        label="E-mail"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        left={<TextInput.Icon icon="email-outline" color={accent} />}
                        style={styles.input}
                        outlineColor={surfaces.border}
                        activeOutlineColor={accent}
                        outlineStyle={styles.outline}
                      />
                    ) : null}
                    <TextInput
                      mode="outlined"
                      label="Hasło"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoComplete="password-new"
                      textContentType="newPassword"
                      left={<TextInput.Icon icon="lock-outline" color={accent} />}
                      right={
                        <TextInput.Icon
                          icon={showPassword ? "eye-off-outline" : "eye-outline"}
                          color={accent}
                          onPress={() => setShowPassword((open) => !open)}
                        />
                      }
                      style={styles.input}
                      outlineColor={surfaces.border}
                      activeOutlineColor={accent}
                      outlineStyle={styles.outline}
                    />
                    {mode === "register" ? (
                      <>
                        <TextInput
                          mode="outlined"
                          label="Powtórz hasło"
                          value={passwordConfirm}
                          onChangeText={setPasswordConfirm}
                          secureTextEntry={!showPassword}
                          autoComplete="off"
                          textContentType="none"
                          left={<TextInput.Icon icon="lock-outline" color={accent} />}
                          style={styles.input}
                          outlineColor={surfaces.border}
                          activeOutlineColor={accent}
                          outlineStyle={styles.outline}
                        />
                        {passwordConfirm.length > 0 && !passwordsMatch ? (
                          <Text style={styles.fieldError}>Hasła nie są takie same</Text>
                        ) : null}
                        <TextInput
                          mode="outlined"
                          label="Kod zaproszenia (opcjonalnie)"
                          placeholder="Tylko gdy dołączasz do rodziny"
                          value={inviteCode}
                          onChangeText={setInviteCode}
                          autoCapitalize="characters"
                          autoCorrect={false}
                          left={<TextInput.Icon icon="ticket-outline" color={accent} />}
                          style={styles.input}
                          outlineColor={surfaces.border}
                          activeOutlineColor={accent}
                          outlineStyle={styles.outline}
                        />
                      </>
                    ) : null}
                  </View>

                  <Pressable
                    onPress={() => {
                      void submitCredentials();
                    }}
                    disabled={busy}
                    style={[styles.cta, { backgroundColor: accent, opacity: busy ? 0.7 : 1 }]}
                  >
                    <Text style={styles.ctaText}>
                      {busy ? "Chwila…" : mode === "login" ? "Otwórz budżet" : "Załóż konto"}
                    </Text>
                    <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
                  </Pressable>
                </>
              ) : (
                <>
                  {step === "setup" && totp ? (
                    <View style={[styles.qrCard, { borderColor: surfaces.border, backgroundColor: surfaces.surface }]}>
                      <View style={styles.qrFrame}>
                        <QRCode value={totp.otpauthUrl} size={168} />
                      </View>
                      <Text style={styles.secretLabel}>Klucz ręczny</Text>
                      <Text style={styles.secret}>{totp.secret}</Text>
                      <Pressable
                        onPress={() => {
                          void Clipboard.setStringAsync(totp.secret).then(() => {
                            setKeyCopied(true);
                            setTimeout(() => setKeyCopied(false), 2500);
                          });
                        }}
                        style={[
                          styles.copyBtn,
                          { borderColor: accent },
                          keyCopied && { backgroundColor: accent, borderColor: accent },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={keyCopied ? "check" : "content-copy"}
                          size={16}
                          color={keyCopied ? "#fff" : accent}
                        />
                        <Text style={[styles.copyText, { color: keyCopied ? "#fff" : accent }]}>
                          {keyCopied ? "Skopiowano" : "Kopiuj klucz"}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  <Text style={styles.otpLabel}>Kod z aplikacji</Text>
                  <Pressable onPress={() => otpRef.current?.focus()} style={styles.otpRow}>
                    {Array.from({ length: 6 }).map((_, index) => {
                      const filled = Boolean(code[index]);
                      const active = code.length === index;
                      return (
                        <View
                          key={index}
                          style={[
                            styles.otpBox,
                            { backgroundColor: surfaces.surface, borderColor: surfaces.border },
                            filled && { borderColor: accent, backgroundColor: surfaces.surfaceStrong },
                            active && { borderColor: accent },
                          ]}
                        >
                          <Text style={[styles.otpDigit, filled && { color: accent }]}>
                            {code[index] ?? ""}
                          </Text>
                        </View>
                      );
                    })}
                  </Pressable>
                  <NativeInput
                    ref={otpRef}
                    value={code}
                    onChangeText={(value) => setCode(value.replace(/[^\d]/g, "").slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                    caretHidden
                    style={styles.hiddenInput}
                    autoFocus
                  />

                  <Pressable
                    onPress={submitCode}
                    disabled={!canSubmitCode}
                    style={[styles.cta, { backgroundColor: canSubmitCode ? accent : surfaces.border }]}
                  >
                    <Text style={styles.ctaText}>{busy ? "Sprawdzam…" : "Potwierdź kod"}</Text>
                    <MaterialCommunityIcons name="shield-check-outline" size={20} color="#fff" />
                  </Pressable>
                  <Pressable onPress={() => goMode(mode)} style={styles.textBack}>
                    <Text style={[styles.textBackLabel, { color: accent }]}>Zmień dane logowania</Text>
                  </Pressable>
                </>
              )}
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
  sheet: {
    flexGrow: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 36,
    marginTop: -12,
  },
  segment: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 4,
    marginBottom: 18,
  },
  segmentItem: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  segmentText: {
    fontFamily: "MontserratSemiBold",
    fontSize: 14,
    color: "#1f1220",
  },
  segmentTextOn: {
    color: "#fff",
  },
  fieldBlock: {
    gap: 2,
  },
  input: {
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  outline: {
    borderRadius: 14,
  },
  fieldError: {
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    color: "#b42318",
    marginTop: -4,
    marginBottom: 10,
  },
  cta: {
    marginTop: 10,
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
  qrCard: {
    borderWidth: 1.5,
    borderRadius: 22,
    padding: 18,
    alignItems: "center",
    marginBottom: 22,
  },
  qrFrame: {
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
  },
  secretLabel: {
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    color: "#6b5f6a",
    marginTop: 14,
  },
  secret: {
    fontFamily: "MontserratSemiBold",
    fontSize: 16,
    letterSpacing: 2,
    color: "#1f1220",
    marginTop: 4,
  },
  copyBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  copyText: {
    fontFamily: "MontserratSemiBold",
    fontSize: 13,
  },
  otpLabel: {
    fontFamily: "MontserratSemiBold",
    fontSize: 13,
    color: "#6b5f6a",
    marginBottom: 10,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  otpBox: {
    width: 46,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  otpDigit: {
    fontFamily: "MontserratSemiBold",
    fontSize: 22,
    color: "#1f1220",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 0,
    width: 0,
  },
  textBack: {
    alignItems: "center",
    marginTop: 14,
  },
  textBackLabel: {
    fontFamily: "MontserratSemiBold",
    fontSize: 14,
  },
});

export default AuthScreen;
