import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { AccountType } from "../db/interfaces";
import {
  confirmTwoFactor,
  createHousehold as createHouseholdRequest,
  fetchMe,
  inviteFamilyMember as inviteFamilyMemberRequest,
  loginAccount,
  registerAccount,
  rotateInviteCode as rotateInviteRequest,
  uploadInviteWrap,
  verifyTwoFactor,
} from "../api/auth";
import { api, apiErrorMessage, setAccessToken } from "../api/client";
import { CloudFamilyPerson, CloudHousehold, CloudMember, CloudUser, SessionPayload, TotpSetup } from "../api/types";
import { wrapDek } from "../crypto/e2e";
import { clearDek, flushUserWrap, requireDek } from "../crypto/keystore";
import { unlockE2e } from "../crypto/unlock";
import { pushSqliteBudget } from "../sync/budget";

export const TOKEN_KEY = "bp_access_token";
const SESSION_KEY = "bp_session";

type CachedSession = {
  user: CloudUser;
  household: CloudHousehold | null;
  cloudMembers: CloudMember[];
  familyPeople: CloudFamilyPerson[];
};

type AuthContextValue = {
  isReady: boolean;
  user: CloudUser | null;
  household: CloudHousehold | null;
  cloudMembers: CloudMember[];
  familyPeople: CloudFamilyPerson[];
  register: (input: {
    username: string;
    password: string;
    passwordConfirm: string;
    email: string;
    displayName: string;
    inviteCode?: string;
  }) => Promise<{ setupToken: string; totp: TotpSetup }>;
  login: (input: { username: string; password: string }) => Promise<
    | { requiresSetup: true; setupToken: string; totp: TotpSetup }
    | { requiresSetup: false; challengeToken: string }
  >;
  confirmSetup: (input: { setupToken: string; code: string; password: string; inviteCode?: string }) => Promise<void>;
  verifyLogin: (input: { challengeToken: string; code: string; password: string }) => Promise<void>;
  createHousehold: (input: { name: string; accountType: AccountType }) => Promise<void>;
  rotateInvite: () => Promise<void>;
  pushBudget: () => Promise<void>;
  invitePerson: (name: string) => Promise<{ inviteCode: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function saveSession(session: CachedSession, token: string) {
  setAccessToken(token);
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [household, setHousehold] = useState<CloudHousehold | null>(null);
  const [cloudMembers, setCloudMembers] = useState<CloudMember[]>([]);
  const [familyPeople, setFamilyPeople] = useState<CloudFamilyPerson[]>([]);

  const applyCached = useCallback((session: CachedSession) => {
    setUser(session.user);
    setHousehold(session.household);
    setCloudMembers(session.cloudMembers);
    setFamilyPeople(session.familyPeople);
  }, []);

  const applySession = useCallback(async (session: SessionPayload, extras?: Partial<CachedSession>) => {
    const cached: CachedSession = {
      user: session.user,
      household: session.household,
      cloudMembers: extras?.cloudMembers ?? [],
      familyPeople: extras?.familyPeople ?? [],
    };
    applyCached(cached);
    await saveSession(cached, session.accessToken);
  }, [applyCached]);

  const refreshMe = useCallback(async () => {
    const me = await fetchMe();
    const cached: CachedSession = {
      user: me.user,
      household: me.household,
      cloudMembers: me.members,
      familyPeople: me.people ?? [],
    };
    applyCached(cached);
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(cached));
    }
    return me;
  }, [applyCached]);

  const logout = useCallback(async () => {
    setAccessToken(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(SESSION_KEY);
    await clearDek();
    setUser(null);
    setHousehold(null);
    setCloudMembers([]);
    setFamilyPeople([]);
  }, []);

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const hadSession = Boolean(api.defaults.headers.common.Authorization);
        if (error.response?.status === 401 && hadSession) {
          await logout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, [logout]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        const raw = await SecureStore.getItemAsync(SESSION_KEY);
        if (token) setAccessToken(token);
        if (raw) {
          applyCached(JSON.parse(raw) as CachedSession);
        }
        if (token) {
          try {
            const me = await fetchMe();
            if (!isMounted) return;
            applyCached({
              user: me.user,
              household: me.household,
              cloudMembers: me.members,
              familyPeople: me.people ?? [],
            });
            await SecureStore.setItemAsync(
              SESSION_KEY,
              JSON.stringify({
                user: me.user,
                household: me.household,
                cloudMembers: me.members,
                familyPeople: me.people ?? [],
              })
            );
          } catch {
            if (!raw) {
              await SecureStore.deleteItemAsync(TOKEN_KEY);
              setAccessToken(null);
            }
          }
        }
      } finally {
        if (isMounted) setIsReady(true);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [applyCached]);

  const register = useCallback(async (input: {
    username: string;
    password: string;
    passwordConfirm: string;
    email: string;
    displayName: string;
    inviteCode?: string;
  }) => {
    return registerAccount(input);
  }, []);

  const login = useCallback(async (input: { username: string; password: string }) => {
    return loginAccount(input);
  }, []);

  const confirmSetup = useCallback(async (input: {
    setupToken: string;
    code: string;
    password: string;
    inviteCode?: string;
  }) => {
    const session = await confirmTwoFactor({ setupToken: input.setupToken, code: input.code });
    setAccessToken(session.accessToken);
    await SecureStore.setItemAsync(TOKEN_KEY, session.accessToken);
    await unlockE2e({ password: input.password, inviteCode: input.inviteCode });
    await applySession(session);
    try {
      await refreshMe();
    } catch {
      // offline after login: local sqlite remains the source
    }
  }, [applySession, refreshMe]);

  const verifyLogin = useCallback(async (input: { challengeToken: string; code: string; password: string }) => {
    const session = await verifyTwoFactor({ challengeToken: input.challengeToken, code: input.code });
    setAccessToken(session.accessToken);
    await SecureStore.setItemAsync(TOKEN_KEY, session.accessToken);
    await unlockE2e({ password: input.password });
    await applySession(session);
    try {
      await refreshMe();
    } catch {
      // offline after login: local sqlite remains the source
    }
  }, [applySession, refreshMe]);

  const createHousehold = useCallback(async (input: { name: string; accountType: AccountType }) => {
    const created = await createHouseholdRequest(input);
    setHousehold(created);
    setUser((current) => (current ? { ...current, householdId: created.id } : current));
    try {
      await flushUserWrap();
    } catch {
      // klucz dojdzie przy następnym syncu
    }
  }, []);

  const rotateInvite = useCallback(async () => {
    const updated = await rotateInviteRequest();
    setHousehold(updated);
  }, []);

  const pushBudget = useCallback(async () => {
    if (!user) return;
    try {
      await flushUserWrap();
    } catch {
      // szyfrogram i tak wyślemy
    }
    const result = await pushSqliteBudget();
    if (result?.people) setFamilyPeople(result.people);
  }, [user]);

  const invitePerson = useCallback(async (name: string) => {
    const result = await inviteFamilyMemberRequest(name);
    setFamilyPeople(result.people);
    const dek = await requireDek();
    const wrap = await wrapDek(dek, result.inviteCode);
    await uploadInviteWrap({
      inviteCode: result.inviteCode,
      salt: wrap.salt,
      wrappedDek: wrap.wrappedDek,
    });
    return { inviteCode: result.inviteCode };
  }, []);

  const value = useMemo(
    () => ({
      isReady,
      user,
      household,
      cloudMembers,
      familyPeople,
      register,
      login,
      confirmSetup,
      verifyLogin,
      createHousehold,
      rotateInvite,
      pushBudget,
      invitePerson,
      logout,
    }),
    [
      isReady,
      user,
      household,
      cloudMembers,
      familyPeople,
      register,
      login,
      confirmSetup,
      verifyLogin,
      createHousehold,
      rotateInvite,
      pushBudget,
      invitePerson,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export { apiErrorMessage };
