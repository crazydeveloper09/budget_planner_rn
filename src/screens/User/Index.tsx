import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import GoalsEditor from "../../components/GoalsEditor";
import PeopleEditor from "../../components/PeopleEditor";
import RecurringEntriesEditor from "../../components/RecurringEntriesEditor";
import { apiErrorMessage, useAuth } from "../../contexts/AuthContext";
import { useFinance } from "../../contexts/FinanceContext";
import { useProfile } from "../../contexts/ProfileContext";
import { getAccountTypeConfig } from "../../helpers/accountTypes";
import { useAccent } from "../../contexts/ThemeContext";
import { allocateGoalSavings } from "../../helpers/goalAllocation";
import { dailyLimitAmount } from "../../helpers/dailyLeftover";
import { formatPln, parseAmount } from "../../helpers/money";
import { currentWallet } from "../../helpers/wallet";

const UserIndexScreen: React.FC = () => {
  const navigation = useNavigation();
  const { accent, surfaces } = useAccent();
  const {
    profile,
    members,
    goals,
    addMember,
    setMemberDailySaldo,
    removeMember,
    canAdmin,
    setWalletBalance,
    setProfileName,
    addGoal,
    updateGoal,
    removeGoal,
  } = useProfile();
  const { entries, addEntry, updateEntry, removeEntry } = useFinance();
  const [walletDraft, setWalletDraft] = useState("");
  const [walletEditing, setWalletEditing] = useState(false);
  const [walletSaving, setWalletSaving] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameEditing, setNameEditing] = useState(false);
  const wallet = currentWallet(profile, entries);
  const showWalletForm = canAdmin && (wallet == null || walletEditing);
  const { user, household, familyPeople, pushBudget, invitePerson } = useAuth();
  const account = profile ? getAccountTypeConfig(profile.accountType) : null;
  const canManagePeople = profile?.accountType === "family" || profile?.accountType === "business";
  const isFamily = profile?.accountType === "family";
  const goalAllocations = allocateGoalSavings(goals, entries, dailyLimitAmount(profile, members));
  const loggedAs =
    user?.role === "member" ? user.familyMemberName || user.displayName : null;
  const recurringExpenses = entries.filter((entry) => entry.regular && entry.type === "expense");
  const recurringIncomes = entries.filter((entry) => entry.regular && entry.type === "income");

  const invite = async (name: string) => {
    if (!household) {
      Alert.alert(
        "Konto w chmurze",
        isFamily
          ? "Najpierw zaloguj konto główne w ustawieniach, potem zaproś członka rodziny."
          : "Najpierw zaloguj konto główne w ustawieniach, potem zaproś pracownika."
      );
      return;
    }
    try {
      await pushBudget();
      const result = await invitePerson(name);
      const budgetName = profile?.name ?? (isFamily ? "rodziny" : "firmy");
      const message =
        `Cześć ${name}!\n\n` +
        `Dołącz do budżetu „${budgetName}” w aplikacji Budget Planner.\n\n` +
        `Przy rejestracji (Nowe konto) wpisz kod zaproszenia:\n${result.inviteCode}\n\n` +
        `Ten kod też odszyfrowuje ${isFamily ? "rodzinny" : "firmowy"} budżet. Nie wysyłaj go publicznie.\n\n` +
        `Potem włącz weryfikację dwustopniową i gotowe.`;
      try {
        await Share.share({
          title: `Zaproszenie do ${budgetName}`,
          message,
        });
      } catch {
        // zamknięcie arkusza udostępniania nie jest błędem zaproszenia
      }
    } catch (error) {
      Alert.alert("Nie udało się zaprosić", apiErrorMessage(error, "Spróbuj ponownie."));
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <View style={styles.nameRow}>
        <Text style={styles.name}>{profile?.name ?? "Profil"}</Text>
        {canAdmin ? (
          <Pressable
            onPress={() => {
              setNameEditing((open) => !open);
              setNameDraft(profile?.name ?? "");
            }}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name={nameEditing ? "close" : "pencil-outline"}
              size={22}
              color={accent}
            />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.meta}>{account?.title}</Text>
      {nameEditing && canAdmin ? (
        <View style={styles.nameForm}>
          <TextInput
            mode="outlined"
            label={account?.nameLabel ?? "Nazwa"}
            placeholder={account?.namePlaceholder}
            value={nameDraft}
            onChangeText={setNameDraft}
            style={styles.walletInput}
            outlineColor="#d7c8d3"
            activeOutlineColor={accent}
          />
          <Button
            mode="contained"
            buttonColor={accent}
            textColor="#fff"
            disabled={!nameDraft.trim()}
            onPress={() => {
              void setProfileName(nameDraft).then(() => setNameEditing(false));
            }}
            style={styles.walletSave}
          >
            Zapisz {account?.nameLabel.toLowerCase() ?? "nazwę"}
          </Button>
        </View>
      ) : null}
      {loggedAs ? <Text style={styles.loggedAs}>Zalogowany jako {loggedAs}</Text> : null}

      <View style={[styles.walletCard, { backgroundColor: surfaces.surface }]}>
        <View style={styles.walletHead}>
          <Text style={styles.walletLabel}>Stan portfela</Text>
          <View style={styles.walletActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Historia portfela" style={styles.walletIconButton} onPress={() => navigation.navigate("WalletHistory" as never)}><MaterialCommunityIcons name="history" size={22} color={accent} /></Pressable>
          {canAdmin && wallet != null ? (
            <Pressable
              onPress={() => setWalletEditing((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={walletEditing ? "Zamknij edycję stanu konta" : "Edytuj stan konta"}
              style={styles.walletIconButton}
            >
              <MaterialCommunityIcons
                name={walletEditing ? "close" : "pencil-outline"}
                size={20}
                color={accent}
              />
            </Pressable>
          ) : null}
          </View>
        </View>
        <Text style={[styles.walletValue, { color: accent }]}>
          {wallet == null ? "Jeszcze nie ustawiony" : formatPln(wallet)}
        </Text>
        {profile?.walletSetOn ? (
          <Text style={styles.walletHint}>
            Ostatnia korekta:{" "}
            {(() => {
              const [year, month, day] = profile.walletSetOn.split("-").map(Number);
              return new Date(year, month - 1, day).toLocaleDateString("pl-PL");
            })()}
          </Text>
        ) : (
          <Text style={styles.walletHint}>Podaj, ile masz teraz na koncie. Kolejne wydatki i wpływy same to ruszają.</Text>
        )}
        {showWalletForm ? (
          <>
            <TextInput
              mode="outlined"
              label="Ustaw aktualny stan konta"
              placeholder="np. 2450"
              value={walletDraft}
              onChangeText={setWalletDraft}
              keyboardType="decimal-pad"
              style={styles.walletInput}
              outlineColor="#d7c8d3"
              activeOutlineColor={accent}
            />
            <Button
              mode="contained"
              buttonColor={accent}
              textColor="#fff"
              loading={walletSaving}
              disabled={walletSaving || parseAmount(walletDraft) === null}
              onPress={async () => {
                const parsed = parseAmount(walletDraft);
                if (parsed === null || walletSaving) return;
                setWalletSaving(true);
                try {
                  await setWalletBalance(parsed);
                  setWalletDraft("");
                  setWalletEditing(false);
                } catch (error) {
                  console.error("Wallet correction failed", error);
                  Alert.alert("Nie zapisano salda", "Spróbuj ponownie.");
                } finally { setWalletSaving(false); }
              }}
              style={styles.walletSave}
            >
              Zapisz stan konta
            </Button>
          </>
        ) : null}

      </View>

      <Pressable
        onPress={() => navigation.navigate("Loans" as never)}
        style={[styles.rankCta, { backgroundColor: surfaces.surface }]}
        accessibilityRole="button"
      >
        <View style={[styles.rankIcon, { backgroundColor: accent }]}>
          <MaterialCommunityIcons name="bank-outline" size={28} color="#fff" />
        </View>
        <View style={styles.rankCopy}>
          <Text style={styles.rankTitle}>Kredyty i pożyczki</Text>
          <Text style={styles.rankDeck}>Kalkulator i harmonogramy spłat</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={accent} />
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate("DailyBudget" as never)}
        style={[styles.rankCta, { backgroundColor: surfaces.surface }]}
        accessibilityRole="button"
      >
        <View style={[styles.rankIcon, { backgroundColor: accent }]}>
          <MaterialCommunityIcons name="piggy-bank-outline" size={28} color="#fff" />
        </View>
        <View style={styles.rankCopy}>
          <Text style={styles.rankTitle}>{isFamily ? "Cel i oszczędności rodziny" : "Dzienny cel i oszczędności"}</Text>
          <Text style={styles.rankDeck}>Ustaw limit i sprawdź, ile możesz odłożyć.</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={accent} />
      </Pressable>

      {isFamily ? (
        <Pressable
          onPress={() => navigation.navigate("FamilyRankings" as never)}
          style={[styles.rankCta, { backgroundColor: surfaces.surface }]}
        >
          <View style={[styles.rankIcon, { backgroundColor: accent }]}>
            <MaterialCommunityIcons name="trophy-outline" size={22} color="#fff" />
          </View>
          <View style={styles.rankCopy}>
            <Text style={styles.rankTitle}>Ranking rodziny</Text>
            <Text style={styles.rankDeck}>Medale, inflacja osobista i kto zjadł budżet.</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={accent} />
        </Pressable>
      ) : profile?.accountType === "personal" ? (
        <Pressable
          onPress={() => navigation.navigate("FamilyRankings" as never)}
          style={[styles.rankCta, { backgroundColor: surfaces.surface }]}
        >
          <View style={[styles.rankIcon, { backgroundColor: accent }]}>
            <MaterialCommunityIcons name="chart-bar" size={22} color="#fff" />
          </View>
          <View style={styles.rankCopy}>
            <Text style={styles.rankTitle}>Podsumowanie miesiąca</Text>
            <Text style={styles.rankDeck}>Na co poszło najwięcej — i krótki werdykt.</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={accent} />
        </Pressable>
      ) : null}

      <GoalsEditor
        items={goals}
        onOpen={(goalId) => navigation.navigate({ name: "GoalDetails", params: { goalId } } as never)}
        autoSavedFor={(goal) => goalAllocations.get(goal.id) ?? 0}
        onAdd={(input) => {
          void addGoal(input);
        }}
        onUpdate={(id, input) => {
          void updateGoal(id, input);
        }}
        onRemove={(id) => {
          void removeGoal(id);
        }}
      />

      {canManagePeople && profile ? (
        <PeopleEditor
          accountType={isFamily ? "family" : "business"}
          people={members}
          collapseForm
          readOnly={!canAdmin}
          canInvite={canAdmin && canManagePeople}
          inviteInfo={familyPeople}
          onInvite={(name) => {
            void invite(name);
          }}
          onAdd={(person) => {
            void addMember(person);
          }}
          onUpdateDailySaldo={async (index, amount) => {
            const member = members[index];
            if (member) await setMemberDailySaldo(member.id, amount);
          }}
          onRemove={(index) => {
            const member = members[index];
            if (member) void removeMember(member.id);
          }}
        />
      ) : null}

      <RecurringEntriesEditor
        title="Stałe wydatki"
        addLabel="Dodaj stały wydatek"
        emptyLabel="Nie dodano jeszcze stałych wydatków"
        kind="expense"
        items={recurringExpenses}
        members={members}
        showOwnerPicker={isFamily}
        readOnly={!canAdmin}
        onAdd={({ name, category, amount, memberId, date }) => {
          void addEntry({
            date,
            type: "expense",
            name,
            category,
            amount,
            regular: true,
            memberId,
          });
        }}
        onUpdate={(id, input) => {
          void updateEntry(id, input);
        }}
        onRemove={(id) => {
          void removeEntry(id);
        }}
      />

      <RecurringEntriesEditor
        title="Stałe wpływy"
        addLabel="Dodaj stały wpływ"
        emptyLabel="Nie dodano jeszcze stałych wpływów"
        kind="income"
        items={recurringIncomes}
        members={members}
        showOwnerPicker={isFamily}
        readOnly={!canAdmin}
        onAdd={({ name, category, amount, memberId, date }) => {
          void addEntry({
            date,
            type: "income",
            name,
            category,
            amount,
            regular: true,
            memberId,
          });
        }}
        onUpdate={(id, input) => {
          void updateEntry(id, input);
        }}
        onRemove={(id) => {
          void removeEntry(id);
        }}
      />
    </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  walletActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  walletIconButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1, backgroundColor: "#fff" },
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
    paddingBottom: 140,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  name: {
    fontFamily: "MontserratSemiBold",
    fontSize: 24,
    color: "#1f1220",
    flex: 1,
  },
  nameForm: {
    marginBottom: 8,
  },
  meta: {
    fontFamily: "PoppinsRegular",
    fontSize: 15,
    color: "#6b5f6a",
    marginTop: 6,
    marginBottom: 8,
  },
  loggedAs: {
    fontFamily: "MontserratSemiBold",
    fontSize: 15,
    color: "#1f1220",
    marginBottom: 12,
  },
  walletCard: {
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  walletHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  walletLabel: {
    fontFamily: "MontserratSemiBold",
    fontSize: 13,
    color: "#6b5f6a",
  },
  walletValue: {
    fontFamily: "MontserratSemiBold",
    fontSize: 26,
    marginTop: 4,
  },
  walletHint: {
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    color: "#6b5f6a",
    marginTop: 6,
    lineHeight: 18,
  },
  walletInput: {
    backgroundColor: "#fff",
    marginTop: 12,
  },
  walletSave: {
    borderRadius: 12,
    marginTop: 8,
  },
  rankCta: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
    marginBottom: 20,
    gap: 12,
  },
  rankIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rankCopy: {
    flex: 1,
  },
  rankTitle: {
    fontFamily: "MontserratSemiBold",
    fontSize: 16,
    color: "#1f1220",
  },
  rankDeck: {
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    color: "#6b5f6a",
    marginTop: 2,
  },
});

export default UserIndexScreen;
