import { AccountType } from "../db/interfaces";
import { api } from "./client";
import { CloudFamilyPerson, CloudHousehold, CloudMember, CloudRecurring, CloudUser, E2eEnvelope, E2eWrap, SessionPayload, TotpSetup } from "./types";

export async function registerAccount(input: {
  username: string;
  password: string;
  passwordConfirm: string;
  email: string;
  displayName: string;
  inviteCode?: string;
}): Promise<{ setupToken: string; totp: TotpSetup }> {
  const { data } = await api.post("/auth/register", input);
  return data;
}

export async function loginAccount(input: {
  username: string;
  password: string;
}): Promise<
  | { requiresSetup: true; setupToken: string; totp: TotpSetup }
  | { requiresSetup: false; challengeToken: string }
> {
  const { data } = await api.post("/auth/login", input);
  return data;
}

export async function confirmTwoFactor(input: {
  setupToken: string;
  code: string;
}): Promise<SessionPayload> {
  const { data } = await api.post("/auth/2fa/confirm", input);
  return data;
}

export async function verifyTwoFactor(input: {
  challengeToken: string;
  code: string;
}): Promise<SessionPayload> {
  const { data } = await api.post("/auth/2fa/verify", input);
  return data;
}

export async function fetchMe(): Promise<{
  user: CloudUser;
  household: CloudHousehold | null;
  members: CloudMember[];
  people: CloudFamilyPerson[];
  recurring: CloudRecurring[];
  e2e?: E2eEnvelope | null;
}> {
  const { data } = await api.get("/me");
  return data;
}

export async function uploadUserWrap(wrap: Pick<E2eWrap, "salt" | "wrappedDek">): Promise<void> {
  await api.post("/e2e/wraps", wrap);
}

export async function uploadInviteWrap(input: {
  inviteCode: string;
  salt: string;
  wrappedDek: string;
}): Promise<void> {
  await api.post("/e2e/wraps", { ...input, kind: "invite" });
}

export async function pushHouseholdSnapshot(input: {
  people: Array<{
    name: string;
    role: "family" | "employee";
    dailySaldo: number | null;
    salary: number | null;
  }>;
  recurring: CloudRecurring[];
}): Promise<{ people: CloudFamilyPerson[]; recurring: CloudRecurring[] }> {
  const { data } = await api.put("/households/snapshot", input);
  return data;
}

export async function inviteFamilyMember(name: string): Promise<{
  name: string;
  inviteCode: string;
  people: CloudFamilyPerson[];
}> {
  const { data } = await api.post("/households/invites", { name });
  return data;
}

export async function createHousehold(input: {
  name: string;
  accountType: AccountType;
}): Promise<CloudHousehold> {
  const { data } = await api.post("/households", input);
  return data.household;
}

export async function rotateInviteCode(): Promise<CloudHousehold> {
  const { data } = await api.post("/households/invite/rotate");
  return data.household;
}
