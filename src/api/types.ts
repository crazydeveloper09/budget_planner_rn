import { AccountType } from "../db/interfaces";

export type CloudRole = "owner" | "member";

export type CloudUser = {
  id: string;
  username: string;
  displayName: string;
  role: CloudRole;
  totpEnabled: boolean;
  householdId: string | null;
  familyMemberName?: string | null;
};

export type CloudHousehold = {
  id: string;
  name: string;
  accountType: AccountType;
  inviteCode: string | null;
  dailySaldo?: number;
  encrypted?: boolean;
};

export type E2eWrap = {
  kind: "user" | "invite";
  salt: string;
  wrappedDek: string;
};

export type E2eEnvelope = {
  version: number;
  nonce: string;
  ciphertext: string;
  wraps: E2eWrap[];
};

export type CloudMember = {
  id: string;
  username: string;
  displayName: string;
  role: CloudRole;
};

export type SessionPayload = {
  accessToken: string;
  user: CloudUser;
  household: CloudHousehold | null;
  e2e?: E2eEnvelope | null;
};

export type TotpSetup = {
  secret: string;
  otpauthUrl: string;
};

export type CloudFamilyPerson = {
  name: string;
  role: "family" | "employee";
  dailySaldo: number | null;
  salary: number | null;
  inviteCode: string | null;
  linked: boolean;
};

export type CloudRecurring = {
  type: "income" | "expense";
  name: string;
  category: string;
  amount: number;
  ownerName: string | null;
};

export type CloudEntry = CloudRecurring & {
  date: string;
  regular: boolean;
};
