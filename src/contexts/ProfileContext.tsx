import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { AccountType, Goal, Member, NewMember, User } from "../db/interfaces";
import { initDb } from "../db/init";
import {
  addGoal as insertGoal,
  listGoals,
  removeGoal as deleteGoal,
  updateGoal as patchGoal,
} from "../db/goals";
import { updateMemberDailySaldo, addMember as insertMember, addMembers, listMembers, removeMember as deleteMember } from "../db/members";
import {
  createProfile,
  getProfile,
  listProfiles,
  setActiveProfileId,
  updateProfile,
} from "../db/profile";
import { listChatMessages, listChatTopics } from "../db/chat";
import { listReceipts } from "../db/receipts";
import { listTransactions } from "../db/transactions";
import { monthKey, toIsoDate } from "../helpers/dates";
import { applyMonthlyRecurringIfDue } from "../helpers/monthlyRecurring";
import { withTimeout } from "../helpers/withTimeout";
import { tokenKey } from "../auth/profileSession";
import * as SecureStore from "expo-secure-store";
import { pullCloudBudgetIntoSqlite } from "../sync/budget";
import { connectLiveSync, disconnectLiveSync } from "../sync/liveSocket";
import { useAuth } from "./AuthContext";
import { hasInternet, watchInternet } from "../sync/connectivity";
import { hasPendingBudget } from "../sync/pendingBudget";

type ProfileContextValue = {
  profile: User | null;
  profiles: User[];
  members: Member[];
  goals: Goal[];
  isReady: boolean;
  canAdmin: boolean;
  ledgerStamp: number;
  refreshProfile: () => Promise<User | null>;
  completeOnboarding: (input: {
    name: string;
    accountType: AccountType;
    members?: NewMember[];
    walletBalance?: number | null;
  }) => Promise<void>;
  switchAccount: (id: number) => Promise<void>;
  addAccount: (input: {
    name: string;
    accountType: AccountType;
    walletBalance: number;
  }) => Promise<void>;
  setMemberDailySaldo: (id: number, amount: number) => Promise<void>;
  addMember: (member: NewMember) => Promise<Member | undefined>;
  removeMember: (id: number) => Promise<void>;
  setWalletBalance: (amount: number) => Promise<void>;
  setDailySaldo: (amount: number) => Promise<void>;
  setProfileName: (name: string) => Promise<void>;
  addGoal: (input: { priority?: number; category?: string; title: string; targetAmount: number; savedAmount: number; deadline: string | null }) => Promise<void>;
  updateGoal: (
    id: string,
    input: { priority?: number; category?: string; title?: string; targetAmount?: number; savedAmount?: number; deadline?: string | null }
  ) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isReady: authReady, user, household, createHousehold, pushBudget, activateForProfile } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<User[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [ledgerStamp, setLedgerStamp] = useState(0);
  const snapshotRef = useRef("");
  const pullingRef = useRef(false);
  const pullAgainRef = useRef(false);
  const canAdmin = user?.role !== "member";

  const loadFromSqlite = useCallback(async () => {
    const all = await listProfiles();
    const existing = await getProfile();
    const existingMembers = existing ? await listMembers(existing.id) : [];
    const existingGoals = existing ? await listGoals(existing.id) : [];
    return { existing, existingMembers, existingGoals, all };
  }, []);

  const snapshotOf = useCallback(async (existing: User | null, existingMembers: Member[], existingGoals: Goal[]) => {
    const entries = existing ? await listTransactions(existing.id) : [];
    const topics = existing ? await listChatTopics(existing.id) : [];
    const messages = existing ? await listChatMessages(existing.id) : [];
    const receipts = existing ? await listReceipts(existing.id) : [];
    return JSON.stringify({
      profile: existing,
      members: existingMembers,
      goals: existingGoals,
      entries: entries.map((entry) => [
        entry.id,
        entry.date,
        entry.type,
        entry.name,
        entry.category,
        entry.amount,
        entry.regular,
        entry.memberId,
      ]),
      chat: { topics, messages },
      receipts: receipts.map((item) => [item.id, item.entryId, item.fileName, item.createdAt]),
    });
  }, []);

  const applySqlite = useCallback(async () => {
    const { existing, existingMembers, existingGoals, all } = await loadFromSqlite();
    const next = await snapshotOf(existing, existingMembers, existingGoals);
    if (next === snapshotRef.current) return existing;
    snapshotRef.current = next;
    setProfile(existing);
    setProfiles(all);
    setMembers(existingMembers);
    setGoals(existingGoals);
    setLedgerStamp((current) => current + 1);
    return existing;
  }, [loadFromSqlite, snapshotOf]);

  const pullLive = useCallback(async () => {
    if (!user || !(await hasInternet())) return;
    if (pullingRef.current) {
      pullAgainRef.current = true;
      return;
    }
    pullingRef.current = true;
    try {
      do {
        pullAgainRef.current = false;
        const active = await getProfile();
        if (active && await hasPendingBudget(active.id)) await pushBudget();
        await pullCloudBudgetIntoSqlite(applySqlite);
        await applySqlite();
      } while (pullAgainRef.current);
    } catch {
      // offline: keep local replica
    } finally {
      pullingRef.current = false;
    }
  }, [applySqlite, user?.id, pushBudget]);

  useEffect(() => {
    if (!authReady) return;
    let isMounted = true;

    (async () => {
      try {
        await withTimeout(initDb(), 6000, "db");

        let { existing, existingMembers, existingGoals, all } = await loadFromSqlite();
        if (!existing && household && user?.role === "member") {
          existing = await createProfile(
            {
              name: household.name,
              accountType: household.accountType,
            },
            { linkCloud: true }
          );
          existingMembers = [];
          existingGoals = [];
          all = [existing];
        }

        if (isMounted) {
          snapshotRef.current = await snapshotOf(existing, existingMembers, existingGoals);
          setProfile(existing);
          setProfiles(all);
          setMembers(existingMembers);
          setGoals(existingGoals);
          setLedgerStamp((current) => current + 1);
        }
      } catch {
        // sqlite: pokaż to, co jest
      } finally {
        if (isMounted) setIsReady(true);
      }

      try {
        if (!isMounted) return;
        const { existing } = await loadFromSqlite();
        if (existing) await activateForProfile(existing.id);
        if (!isMounted) return;

        const posted = await applyMonthlyRecurringIfDue();
        if (posted && isMounted) {
          await applySqlite();
          await pushBudget();
        }
      } catch {
        // chmura po starcie
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [authReady, household?.id, user?.id, user?.role, activateForProfile, loadFromSqlite, pushBudget, snapshotOf]);

  useEffect(() => {
    if (!isReady || !user || !household?.id) return;

    let cancelled = false;
    let online = false;
    let connectionGeneration = 0;
    const connect = async () => {
      const generation = ++connectionGeneration;
      const token = await SecureStore.getItemAsync(tokenKey());
      if (cancelled || generation !== connectionGeneration || !online || AppState.currentState !== "active" || !token) return;
      // The connect event catches up once at startup and after socket reconnection.
      connectLiveSync(token, () => void pullLive());
    };
    const stopWatching = watchInternet((connected) => {
      online = connected;
      if (connected) void connect().catch(() => undefined);
      else {
        connectionGeneration++;
        disconnectLiveSync();
      }
    });
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        connectionGeneration++;
        disconnectLiveSync();
        return;
      }
      if (online) void connect().catch(() => undefined);
      void (async () => {
        const posted = await applyMonthlyRecurringIfDue();
        if (posted && !cancelled) {
          await applySqlite();
          await pushBudget();
        }
      })().catch(() => { /* Changes stay local until connectivity returns. */ });
    });
    return () => {
      cancelled = true;
      connectionGeneration++;
      stopWatching();
      disconnectLiveSync();
      sub.remove();
    };
  }, [isReady, user?.id, household?.id, pullLive, pushBudget, applySqlite]);

  const completeOnboarding = useCallback(async (input: {
    name: string;
    accountType: AccountType;
    members?: NewMember[];
    walletBalance?: number | null;
  }) => {
    if (user && !household) {
      await createHousehold({
        name: input.name,
        accountType: input.accountType,
      });
    }
    const existing = await getProfile();
    const entries = existing ? await listTransactions(existing.id) : [];
    const afterId = entries.reduce((max, entry) => Math.max(max, entry.id), 0);
    const walletBalance = input.walletBalance ?? null;
    const created =
      existing
        ? (await updateProfile(existing.id, {
            name: input.name,
            accountType: input.accountType,
            walletBalance,
            recordWalletChange: true,
            walletSetOn: walletBalance == null ? null : toIsoDate(new Date()),
            walletAfterId: afterId,
            walletRecurringMonth: monthKey(),
          })) ?? existing
        : await createProfile(
            {
              name: input.name,
              accountType: input.accountType,
              walletBalance,
              walletSetOn: walletBalance == null ? null : toIsoDate(new Date()),
              walletAfterId: afterId,
              walletRecurringMonth: monthKey(),
            },
            { linkCloud: true }
          );
    await activateForProfile(created.id);
    const savedMembers =
      existing
        ? await listMembers(created.id)
        : input.members?.length
          ? await addMembers(created.id, input.members)
          : [];
    setProfile(created);
    setProfiles(await listProfiles());
    setMembers(savedMembers);
    setGoals([]);
    try {
      await pushBudget();
    } catch {
      // local profile is already saved
    }
  }, [activateForProfile, createHousehold, household, pushBudget, user]);

  const applyActive = useCallback(async () => {
    const { existing, existingMembers, existingGoals, all } = await loadFromSqlite();
    snapshotRef.current = await snapshotOf(existing, existingMembers, existingGoals);
    setProfile(existing);
    setProfiles(all);
    setMembers(existingMembers);
    setGoals(existingGoals);
    setLedgerStamp((current) => current + 1);
    const posted = await applyMonthlyRecurringIfDue();
    if (posted) {
      const again = await loadFromSqlite();
      snapshotRef.current = await snapshotOf(again.existing, again.existingMembers, again.existingGoals);
      setProfile(again.existing);
      setProfiles(again.all);
      setMembers(again.existingMembers);
      setGoals(again.existingGoals);
      setLedgerStamp((current) => current + 1);
    }
  }, [loadFromSqlite, snapshotOf]);

  const switchAccount = useCallback(
    async (id: number) => {
      disconnectLiveSync();
      await setActiveProfileId(id);
      await activateForProfile(id);
      await applyActive();
    },
    [activateForProfile, applyActive]
  );

  const addAccount = useCallback(
    async (input: { name: string; accountType: AccountType; walletBalance: number }) => {
      const existingOfType = (await listProfiles()).find((item) => item.accountType === input.accountType);
      if (existingOfType) {
        await switchAccount(existingOfType.id);
        return;
      }
      const created = await createProfile({
        name: input.name,
        accountType: input.accountType,
        walletBalance: input.walletBalance,
        walletSetOn: toIsoDate(new Date()),
        walletAfterId: 0,
        walletRecurringMonth: monthKey(),
      });
      await activateForProfile(created.id);
      await applyActive();
    },
    [activateForProfile, applyActive, switchAccount]
  );

  const addMember = useCallback(async (member: NewMember) => {
    if (!profile) return;
    const created = await insertMember(profile.id, member);
    setMembers((current) => [...current, created]);
    try {
      await pushBudget();
    } catch {
      // local member is already saved
    }
    return created;
  }, [profile, pushBudget]);

  const setMemberDailySaldo = useCallback(async (id: number, amount: number) => {
    if (!profile || !canAdmin || !members.some(member => member.id === id && member.role === "family")) return;
    await updateMemberDailySaldo(profile.id, id, amount);
    setMembers(await listMembers(profile.id));
    try {
      await pushBudget();
    } catch {
      // The local limit is saved and will sync later.
    }
  }, [profile, canAdmin, members, pushBudget]);

  const setWalletBalance = useCallback(async (amount: number) => {
    if (!profile) return;
    const entries = await listTransactions(profile.id);
    const afterId = entries.reduce((max, entry) => Math.max(max, entry.id), 0);
    const updated = await updateProfile(profile.id, {
      walletBalance: amount,
      recordWalletChange: true,
      walletSetOn: toIsoDate(new Date()),
      walletAfterId: afterId,
    });
    if (updated) setProfile(updated);
    try {
      await pushBudget();
    } catch {
      // local wallet stays
    }
  }, [profile, pushBudget]);

  const setDailySaldo = useCallback(async (amount: number) => {
    if (!profile) return;
    const updated = await updateProfile(profile.id, { dailySaldo: amount });
    if (updated) setProfile(updated);
    try {
      await pushBudget();
    } catch {
      // local limit stays
    }
  }, [profile, pushBudget]);

  const setProfileName = useCallback(async (name: string) => {
    if (!profile) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const updated = await updateProfile(profile.id, { name: trimmed });
    if (updated) {
      setProfile(updated);
      setProfiles(await listProfiles());
    }
    try {
      await pushBudget();
    } catch {
      // local name stays
    }
  }, [profile, pushBudget]);

  const addGoal = useCallback(
    async (input: { priority?: number; category?: string; title: string; targetAmount: number; savedAmount: number; deadline: string | null }) => {
      if (!profile) return;
      const created = await insertGoal(profile.id, input);
      setGoals((current) => [created, ...current]);
      try {
        await pushBudget();
      } catch {
        // local goal stays
      }
    },
    [profile, pushBudget]
  );

  const updateGoal = useCallback(
    async (
      id: string,
      input: { priority?: number; category?: string; title?: string; targetAmount?: number; savedAmount?: number; deadline?: string | null }
    ) => {
      await patchGoal(id, input);
      setGoals((current) =>
        current.map((goal) =>
          goal.id === id
            ? {
                ...goal,
                title: input.title?.trim() || goal.title,
                category: input.category ?? goal.category ?? "Inne",
                priority: input.priority ?? goal.priority ?? 2,
                targetAmount: input.targetAmount ?? goal.targetAmount,
                savedAmount: input.savedAmount ?? goal.savedAmount,
                deadline: input.deadline === undefined ? goal.deadline : input.deadline,
              }
            : goal
        )
      );
      try {
        await pushBudget();
      } catch {
        // local update stays
      }
    },
    [pushBudget]
  );

  const removeGoal = useCallback(
    async (id: string) => {
      await deleteGoal(id);
      setGoals((current) => current.filter((goal) => goal.id !== id));
      try {
        await pushBudget();
      } catch {
        // local delete stays
      }
    },
    [pushBudget]
  );

  const removeMember = useCallback(async (id: number) => {
    await deleteMember(id);
    setMembers((current) => current.filter((member) => member.id !== id));
    try {
      await pushBudget();
    } catch {
      // local delete already applied
    }
  }, [pushBudget]);

  const value = useMemo(
    () => ({
      profile,
      profiles,
      members,
      goals,
      isReady,
      canAdmin,
      ledgerStamp,
      refreshProfile: applySqlite,
      completeOnboarding,
      switchAccount,
      addAccount,
      addMember,
      setMemberDailySaldo,
      removeMember,
      setWalletBalance,
      setDailySaldo,
      setProfileName,
      addGoal,
      updateGoal,
      removeGoal,
    }),
    [
      profile,
      profiles,
      members,
      goals,
      isReady,
      canAdmin,
      ledgerStamp,
      applySqlite,
      completeOnboarding,
      switchAccount,
      addAccount,
      addMember,
      setMemberDailySaldo,
      removeMember,
      setWalletBalance,
      setDailySaldo,
      setProfileName,
      addGoal,
      updateGoal,
      removeGoal,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return context;
}
