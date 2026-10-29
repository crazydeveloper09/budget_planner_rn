import mongoose, { Schema } from "mongoose";

export type ReceiptDoc = {
  householdId: mongoose.Types.ObjectId;
  receiptId: string;
  deleted: boolean;
  nonce: string;
  ciphertext: string;
  updatedAt?: Date;
};

const receiptSchema = new Schema<ReceiptDoc>(
  {
    householdId: { type: Schema.Types.ObjectId, ref: "Household", required: true, index: true },
    receiptId: { type: String, required: true },
    deleted: { type: Boolean, default: false },
    nonce: { type: String, default: "" },
    ciphertext: { type: String, default: "" },
  },
  { timestamps: true }
);

receiptSchema.index({ householdId: 1, receiptId: 1 }, { unique: true });

export const Receipt = mongoose.model("Receipt", receiptSchema);
