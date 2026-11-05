import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WalletHistory from "../../components/WalletHistory";
import { useProfile } from "../../contexts/ProfileContext";
import { useFinance } from "../../contexts/FinanceContext";

export default function WalletHistoryScreen() {
  const { profile, members } = useProfile();
  const { entries } = useFinance();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 104 }]}>
      <WalletHistory key={profile?.id ?? "empty"} profile={profile} entries={entries} members={members} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
});
