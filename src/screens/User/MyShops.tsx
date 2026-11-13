import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, HelperText, IconButton, Text, TextInput } from "react-native-paper";
import CategoryPicker from "../../components/CategoryPicker";
import { useAccent } from "../../contexts/ThemeContext";
import { EXPENSE_CATEGORIES } from "../../helpers/categories";
import { useProfile } from "../../contexts/ProfileContext";
import { addShop, readShops, Shop } from "../../helpers/shops";

function ShopForm({ profileId }: { profileId: number }) {
  const navigation = useNavigation();
  const { accent, surfaces } = useAccent();
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [shops, setShops] = useState<Shop[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const pending = useRef(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton icon="plus" iconColor="#fff" style={styles.headerAdd} accessibilityLabel="Dodaj sklep" disabled={!loaded} onPress={() => setOpen(true)} />
      ),
    });
  }, [navigation, loaded]);

  useEffect(() => {
    let active = true;
    void readShops(profileId).then(result => {
      if (active) {
        setShops(result);
        setLoaded(true);
      }
    }).catch(() => {
      if (active) setLoadError("Nie udało się wczytać sklepów.");
    });
    return () => { active = false; };
  }, [profileId]);

  const close = () => {
    if (pending.current) return;
    setOpen(false);
    setName("");
    setCategory("");
    setError("");
  };

  const save = async () => {
    if (pending.current || !loaded) return;
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      setShops(await addShop(profileId, { name, category }));
      setOpen(false);
      setName("");
      setCategory("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Nie udało się zapisać sklepu.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  const groups = EXPENSE_CATEGORIES.map(category => ({
    ...category,
    shops: shops.filter(shop => shop.category === category.label)
      .sort((a, b) => a.name.localeCompare(b.name, "pl")),
  })).filter(group => group.shops.length);

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        {loadError ? <Text accessibilityRole="alert">{loadError}</Text> : null}
        {loaded && !shops.length && (
          <View style={[styles.empty, { backgroundColor: surfaces.surface, borderColor: surfaces.border }]}>
            <View style={[styles.icon, { backgroundColor: surfaces.surfaceStrong }]}>
              <MaterialCommunityIcons name="store-outline" size={24} color={accent} />
            </View>
            <Text style={styles.groupTitle}>Nie dodano jeszcze własnych sklepów</Text>
            <Button textColor={accent} icon="plus" onPress={() => setOpen(true)}>Dodaj sklep</Button>
          </View>
        )}
        {groups.map(group => (
          <View key={group.label} style={[styles.card, { backgroundColor: surfaces.surface, borderColor: surfaces.border }]}>
            <View style={styles.groupHeader}>
              <View style={[styles.icon, { backgroundColor: surfaces.surfaceStrong }]}>
                <MaterialCommunityIcons name={group.icon} size={21} color={accent} />
              </View>
              <Text accessibilityRole="header" style={styles.groupTitle}>{group.label}</Text>
            </View>
            {group.shops.map(shop => (
              <View key={shop.name} style={[styles.shopRow, { borderTopColor: surfaces.border }]}>
                <Text variant="bodyLarge">{shop.name}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <View style={styles.header}>
              <View style={[styles.icon, { backgroundColor: surfaces.surfaceStrong }]}>
                <MaterialCommunityIcons name="store-outline" size={23} color={accent} />
              </View>
              <Text variant="titleLarge" accessibilityRole="header" style={styles.dialogTitle}>Dodaj sklep</Text>
              <IconButton icon="close" mode="contained-tonal" accessibilityLabel="Zamknij formularz" disabled={saving} onPress={close} />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
              <TextInput mode="outlined" outlineColor={surfaces.border} activeOutlineColor={accent} label="Nazwa sklepu" value={name} onChangeText={setName} maxLength={100} />
              <CategoryPicker type="expense" value={category} onChange={setCategory} />
            </ScrollView>
            <View style={[styles.actions, { borderTopColor: surfaces.border }]}>
              {error ? <HelperText type="error" visible padding="none" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</HelperText> : null}
              <Button mode="contained" buttonColor={accent} icon="check" contentStyle={styles.saveButton} disabled={!loaded || !name.trim() || !category || saving} loading={saving} onPress={save}>
                Dodaj sklep
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

export default function MyShopsScreen() {
  const { profile } = useProfile();
  return profile ? <ShopForm key={profile.id} profileId={profile.id} /> : null;
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  groupHeader: { flexDirection: "row", alignItems: "center", padding: 12, gap: 12 },
  groupTitle: { fontFamily: "MontserratSemiBold", textAlign: "center" },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  shopRow: { minHeight: 48, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  empty: { alignItems: "center", padding: 24, gap: 12, borderRadius: 18, borderWidth: 1 },
  overlay: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "rgba(31,18,32,0.48)" },
  headerAdd: { margin: 0, marginRight: -8 },
  dialog: { backgroundColor: "#fff", borderRadius: 24, maxHeight: "90%", width: "100%", maxWidth: 520, alignSelf: "center", overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  dialogTitle: { flex: 1, fontFamily: "MontserratSemiBold" },
  form: { paddingHorizontal: 16, paddingVertical: 8, gap: 16 },
  actions: { borderTopWidth: StyleSheet.hairlineWidth, padding: 16 },
  error: { marginBottom: 8 },
  saveButton: { minHeight: 46 },
});
