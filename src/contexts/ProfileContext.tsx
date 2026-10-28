import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { AccountType, Member, NewMember, User } from "../db/interfaces";
import { initDb } from "../db/init";
import { addMember as insertMember, addMembers, listMembers, removeMember as deleteMember } from "../db/members";
import { createProfile, getProfile } from "../db/profile";
import { listTransactions } from "../db/transactions";
import * as SecureStore from "expo-secure-store";
import { pullCloudBudgetIntoSqlite } from "../sync/budget";
import { connectLiveSync, disconnectLiveSync } from "../sync/liveSocket";
import { TOKEN_KEY, useAuth } from "./AuthContext";

type ProfileContextValue = {
  profile: User | null;
  members: Member[];
  isReady: boolean;
  canAdmin: boolean;
  ledgerStamp: number;
  completeOnboarding: (input: {
    name: string;
    accountType: AccountType;
    members?: NewMember[];
  }) => Promise<void>;
  addMember: (member: NewMember) => Promise<Member | undefined>;
  removeMember: (id: number) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isReady: authReady, user, household, createHousehold, pushBudget } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [ledgerStamp, setLedgerStamp] = useState(0);
  const snapshotRef = useRef("");
  const pullingRef = useRef(false);
  const canAdmin = user?.role !== "member";

  const loadFromSqlite = useCallback(async () => {
    const existing = await getProfile();
    const existingMembers = existing ? await listMembers(existing.id) : [];
    return { existing, existingMembers };
  }, []);

  const snapshotOf = useCallback(async (existing: User | null, existingMembers: Member[]) => {
    const entries = existing ? await listTransactions(existing.id) : [];
    return JSON.stringify({
      profile: existing,
      members: existingMembers,
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
    });
  }, []);

  const applySqlite = useCallback(async () => {
    const { existing, existingMembers } = await loadFromSqlite();
    const next = await snapshotOf(existing, existingMembers);
    if (next === snapshotRef.current) return existing;
    snapshotRef.current = next;
    setProfile(existing);
    setMembers(existingMembers);
    setLedgerStamp((current) => current + 1);
    return existing;
  }, [loadFromSqlite, snapshotOf]);

  const pullLive = useCallback(async () => {
    if (!user || pullingRef.current) return;
    pullingRef.current = true;
    try {
      await pullCloudBudgetIntoSqlite();
      await applySqlite();
    } catch {
      // offline: keep local replica
    } finally {
      pullingRef.current = false;
    }
  }, [applySqlite, user]);

  useEffect(() => {
    if (!authReady) return;
    let isMounted = true;

    (async () => {
      try {
        await initDb();

        if (user?.role === "member") {
          try {
            await pullCloudBudgetIntoSqlite();
          } catch {
            // no network: keep whatever sqlite already has
          }
        }

        let { existing, existingMembers } = await loadFromSqlite();
        if (!existing && household && user?.role === "member") {
          existing = await createProfile({
            name: household.name,
            accountType: household.accountType,
          });
          existingMembers = [];
        }

        if (isMounted) {
          snapshotRef.current = await snapshotOf(existing, existingMembers);
          setProfile(existing);
          setMembers(existingMembers);
          setLedgerStamp((current) => current + 1);
        }

        if (user?.role === "owner" && existing) {
          try {
            await pushBudget();
          } catch {
            // sqlite stays the source; cloud waits for next online change
          }
        }
      } finally {
        if (isMounted) setIsReady(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [authReady, household?.id, user?.id, user?.role, loadFromSqlite, pushBudget, snapshotOf]);

  useEffect(() => {
    if (!isReady || !user) return;

    let cancelled = false;
    void SecureStore.getItemAsync(TOKEN_KEY).then((token) => {
      if (!token || cancelled) return;
      connectLiveSync(token, () => {
        void pullLive();
      });
    });

    const onAppState = (state: string) => {
      if (state !== "active") return;
      if (user.role === "owner") {
        void pushBudget();
        return;
      }
      void pullLive();
    };
    const sub = AppState.addEventListener("change", onAppState);

    return () => {
      cancelled = true;
      disconnectLiveSync();
      sub.remove();
    };
  }, [isReady, user, pullLive, pushBudget]);

  const completeOnboarding = useCallback(async (input: {
    name: string;
    accountType: AccountType;
    members?: NewMember[];
  }) => {
    if (user && !household) {
      await createHousehold({
        name: input.name,
        accountType: input.accountType,
      });
    }
    const existing = await getProfile();
    const created =
      existing ??
      (await createProfile({
        name: input.name,
        accountType: input.accountType,
      }));
    const savedMembers =
      existing
        ? await listMembers(created.id)
        : input.members?.length
          ? await addMembers(created.id, input.members)
          : [];
    setProfile(created);
    setMembers(savedMembers);
    try {
      await pushBudget();
    } catch {
      // local profile is already saved
    }
  }, [createHousehold, household, pushBudget, user]);

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
      members,
      isReady,
      canAdmin,
      ledgerStamp,
      completeOnboarding,
      addMember,
      removeMember,
    }),
    [profile, members, isReady, canAdmin, ledgerStamp, completeOnboarding, addMember, removeMember]
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
