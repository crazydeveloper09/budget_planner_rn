import mongoose, { Schema } from "mongoose";

export type AccountRole = "owner" | "member";

export type UserDoc = {
  username: string;
  usernameLower: string;
  email: string | null;
  emailLower: string | null;
  passwordHash: string;
  displayName: string;
  role: AccountRole;
  householdId: mongoose.Types.ObjectId | null;
  totpSecretEnc: string | null;
  totpEnabled: boolean;
  familyMemberName: string | null;
  expoPushTokens: string[];
};

const userSchema = new Schema<UserDoc>(
  {
    username: { type: String, required: true, trim: true },
    usernameLower: { type: String, required: true, unique: true },
    email: { type: String, default: null, trim: true },
    emailLower: { type: String, default: null, unique: true, sparse: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    role: { type: String, enum: ["owner", "member"], required: true },
    householdId: { type: Schema.Types.ObjectId, ref: "Household", default: null },
    totpSecretEnc: { type: String, default: null },
    totpEnabled: { type: Boolean, default: false },
    familyMemberName: { type: String, default: null },
    expoPushTokens: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
