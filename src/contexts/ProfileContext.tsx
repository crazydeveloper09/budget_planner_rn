import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AccountType, Member, NewMember, User } from "../db/interfaces";
import { initDb } from "../db/init";
import { addMember as insertMember, addMembers, listMembers, removeMember as deleteMember } from "../db/members";
import { createProfile, getProfile } from "../db/profile";
import { pullCloudBudgetIntoSqlite } from "../sync/budget";
import { useAuth } from "./AuthContext";

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
  const canAdmin = user?.role !== "member";

  const loadFromSqlite = useCallback(async () => {
    const existing = await getProfile();
    const existingMembers = existing ? await listMembers(existing.id) : [];
    return { existing, existingMembers };
  }, []);

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
  }, [authReady, household?.id, user?.id, user?.role, loadFromSqlite, pushBudget]);

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
