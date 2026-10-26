import mongoose, { Schema } from "mongoose";

export type AccountType = "personal" | "business" | "family";

export type HouseholdPerson = {
  name: string;
  role: "family" | "employee";
  dailySaldo: number | null;
  salary: number | null;
  inviteCode: string | null;
  linkedUserId: mongoose.Types.ObjectId | null;
};

export type HouseholdRecurring = {
  entryKind: "income" | "expense";
  title: string;
  category: string;
  amount: number;
  ownerName: string | null;
};

export type HouseholdEntry = {
  entryDate: string;
  entryKind: "income" | "expense";
  title: string;
  category: string;
  amount: number;
  isRegular: boolean;
  ownerName: string | null;
};

export type E2eWrapDoc = {
  kind: "user" | "invite";
  userId: mongoose.Types.ObjectId | null;
  inviteCode: string | null;
  salt: string;
  wrappedDek: string;
};

export type HouseholdE2e = {
  version: number;
  nonce: string;
  ciphertext: string;
  wraps: E2eWrapDoc[];
};

export type HouseholdDoc = {
  name: string;
  accountType: AccountType;
  ownerId: mongoose.Types.ObjectId;
  inviteCode: string;
  dailySaldo: number;
  people: HouseholdPerson[];
  recurring: HouseholdRecurring[];
  entries: HouseholdEntry[];
  e2e?: HouseholdE2e | null;
};

const householdSchema = new Schema<HouseholdDoc>(
  {
    name: { type: String, required: true, trim: true },
    accountType: { type: String, enum: ["personal", "business", "family"], required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    inviteCode: { type: String, required: true, unique: true },
    dailySaldo: { type: Number, default: 100 },
    people: {
      type: [
        {
          name: { type: String, required: true, trim: true },
          role: { type: String, enum: ["family", "employee"], required: true },
          dailySaldo: { type: Number, default: null },
          salary: { type: Number, default: null },
          inviteCode: { type: String, default: null },
          linkedUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
        },
      ],
      default: [],
    },
    recurring: {
      type: [
        {
          entryKind: { type: String, enum: ["income", "expense"], required: true },
          title: { type: String, default: "" },
          category: { type: String, required: true },
          amount: { type: Number, required: true },
          ownerName: { type: String, default: null },
        },
      ],
      default: [],
    },
    entries: {
      type: [
        {
          entryDate: { type: String, required: true },
          entryKind: { type: String, enum: ["income", "expense"], required: true },
          title: { type: String, default: "" },
          category: { type: String, required: true },
          amount: { type: Number, required: true },
          isRegular: { type: Boolean, default: false },
          ownerName: { type: String, default: null },
        },
      ],
      default: [],
    },
    e2e: {
      version: { type: Number, default: 0 },
      nonce: { type: String, default: "" },
      ciphertext: { type: String, default: "" },
      wraps: {
        type: [
          {
            kind: { type: String, enum: ["user", "invite"], required: true },
            userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
            inviteCode: { type: String, default: null },
            salt: { type: String, required: true },
            wrappedDek: { type: String, required: true },
          },
        ],
        default: [],
      },
    },
  },
  { timestamps: true }
);

export const Household = mongoose.model("Household", householdSchema);
