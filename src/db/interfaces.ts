export type AccountType = "personal" | "business" | "family";

export interface User {
  id: number;
  name: string;
  accountType: AccountType;
  dailySaldo: number;
  currency: string;
}

export type MemberRole = "family" | "employee";

export interface Member {
  id: number;
  userId: number;
  name: string;
  role: MemberRole;
  dailySaldo: number | null;
  salary: number | null;
}

export type NewMember = Omit<Member, "id" | "userId">;

export type TransactionType = "income" | "expense";

export interface Transaction {
  id: number;
  userId: number;
  date: string;
  type: TransactionType;
  name: string;
  category: string;
  amount: number;
  regular: boolean;
  memberId: number | null;
}

export type NewTransaction = Omit<Transaction, "id" | "userId">;
