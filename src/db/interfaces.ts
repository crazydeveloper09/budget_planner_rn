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

export type Receipt = {
  id: string;
  userId: number;
  entryId: number | null;
  date: string;
  name: string;
  category: string;
  amount: number;
  ownerName: string | null;
  createdAt: string;
  uri: string;
  fileName: string;
};

export type NewReceipt = Omit<Receipt, "userId">;

export type ChatPlan = {
  type: TransactionType;
  name: string;
  category: string;
  amount: number;
  date: string;
  memberId: number | null;
  ownerName?: string | null;
};

export type ChatTopic = {
  id: string;
  userId: number;
  title: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  userId: number;
  topicId: string;
  authorName: string;
  body: string;
  createdAt: string;
  plan: ChatPlan | null;
};
