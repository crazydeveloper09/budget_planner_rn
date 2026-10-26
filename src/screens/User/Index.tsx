import React from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import PeopleEditor from "../../components/PeopleEditor";
import RecurringEntriesEditor from "../../components/RecurringEntriesEditor";
import { apiErrorMessage, useAuth } from "../../contexts/AuthContext";
import { useFinance } from "../../contexts/FinanceContext";
import { useProfile } from "../../contexts/ProfileContext";
import { getAccountTypeConfig } from "../../helpers/accountTypes";
import { useAccent } from "../../contexts/ThemeContext";
import { toIsoDate } from "../../helpers/dates";

const UserIndexScreen: React.FC = () => {
  const navigation = useNavigation();
  const { accent, surfaces } = useAccent();
  const { profile, members, addMember, removeMember, canAdmin } = useProfile();
  const { entries, addEntry, removeEntry } = useFinance();
  const { user, household, familyPeople, pushBudget, invitePerson } = useAuth();
  const account = profile ? getAccountTypeConfig(profile.accountType) : null;
  const canManagePeople = profile?.accountType === "family" || profile?.accountType === "business";
  const isFamily = profile?.accountType === "family";
  const loggedAs =
    user?.role === "member" ? user.familyMemberName || user.displayName : null;
  const recurringExpenses = entries.filter((entry) => entry.regular && entry.type === "expense");
  const recurringIncomes = entries.filter((entry) => entry.regular && entry.type === "income");

  const invite = async (name: string) => {
    if (!household) {
      Alert.alert("Konto w chmurze", "Najpierw zaloguj konto główne w ustawieniach, potem zaproś członka rodziny.");
      return;
    }
    try {
      await pushBudget();
      const result = await invitePerson(name);
      const familyName = profile?.name ?? "rodziny";
      const message =
        `Cześć ${name}!\n\n` +
        `Dołącz do budżetu „${familyName}” w aplikacji Budget Planner.\n\n` +
        `Przy rejestracji (Nowe konto) wpisz kod zaproszenia:\n${result.inviteCode}\n\n` +
        `Ten kod też odszyfrowuje rodzinny budżet. Nie wysyłaj go publicznie.\n\n` +
        `Potem włącz weryfikację dwustopniową i gotowe.`;
      try {
        await Share.share({
          title: `Zaproszenie do ${familyName}`,
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{profile?.name ?? "Profil"}</Text>
      <Text style={styles.meta}>{account?.title}</Text>
      {loggedAs ? <Text style={styles.loggedAs}>Zalogowany jako {loggedAs}</Text> : null}

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
      ) : null}

      {canManagePeople && profile ? (
        <PeopleEditor
          accountType={profile.accountType}
          people={members}
          collapseForm
          readOnly={!canAdmin}
          canInvite={canAdmin && isFamily}
          inviteInfo={familyPeople}
          onInvite={(name) => {
            void invite(name);
          }}
          onAdd={(person) => {
            void addMember(person);
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
        onAdd={({ name, category, amount, memberId }) => {
          void addEntry({
            date: toIsoDate(new Date()),
            type: "expense",
            name,
            category,
            amount,
            regular: true,
            memberId,
          });
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
        onAdd={({ name, category, amount, memberId }) => {
          void addEntry({
            date: toIsoDate(new Date()),
            type: "income",
            name,
            category,
            amount,
            regular: true,
            memberId,
          });
        }}
        onRemove={(id) => {
          void removeEntry(id);
        }}
      />
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
  name: {
    fontFamily: "MontserratSemiBold",
    fontSize: 24,
    color: "#1f1220",
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
