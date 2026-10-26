import { gcm } from "@noble/ciphers/aes";
import { pbkdf2Async } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha256";
import { getRandomBytes } from "expo-crypto";
import { bytesToHex, hexToBytes, utf8Bytes, utf8String } from "./bytes";
import { CloudEntry, E2eEnvelope, E2eWrap } from "../api/types";
import { AccountType } from "../db/interfaces";

const PBKDF2_ITERS = 120_000;

export type BudgetPlaintext = {
  profile: {
    name: string;
    accountType: AccountType;
    dailySaldo?: number;
  };
  people: Array<{
    name: string;
    role: "family" | "employee";
    dailySaldo: number | null;
    salary: number | null;
  }>;
  entries: CloudEntry[];
};

export function randomDek(): Uint8Array {
  return getRandomBytes(32);
}

async function kekFromSecret(secret: string, salt: Uint8Array): Promise<Uint8Array> {
  return pbkdf2Async(sha256, secret, salt, { c: PBKDF2_ITERS, dkLen: 32 });
}

export async function wrapDek(dek: Uint8Array, secret: string): Promise<E2eWrap> {
  const salt = getRandomBytes(16);
  const nonce = getRandomBytes(12);
  const kek = await kekFromSecret(secret, salt);
  const wrapped = gcm(kek, nonce).encrypt(dek);
  return {
    kind: "user",
    salt: bytesToHex(salt),
    wrappedDek: `${bytesToHex(nonce)}${bytesToHex(wrapped)}`,
  };
}

export async function unwrapDek(wrap: E2eWrap, secret: string): Promise<Uint8Array> {
  const salt = hexToBytes(wrap.salt);
  const packed = hexToBytes(wrap.wrappedDek);
  const nonce = packed.subarray(0, 12);
  const wrapped = packed.subarray(12);
  const kek = await kekFromSecret(secret, salt);
  return gcm(kek, nonce).decrypt(wrapped);
}

export function encryptBudget(dek: Uint8Array, payload: BudgetPlaintext): Pick<E2eEnvelope, "nonce" | "ciphertext" | "version"> {
  const nonce = getRandomBytes(12);
  const ciphertext = gcm(dek, nonce).encrypt(utf8Bytes(JSON.stringify(payload)));
  return {
    version: 1,
    nonce: bytesToHex(nonce),
    ciphertext: bytesToHex(ciphertext),
  };
}

export function decryptBudget(dek: Uint8Array, envelope: Pick<E2eEnvelope, "nonce" | "ciphertext">): BudgetPlaintext {
  const nonce = hexToBytes(envelope.nonce);
  const ciphertext = hexToBytes(envelope.ciphertext);
  const plain = utf8String(gcm(dek, nonce).decrypt(ciphertext));
  return JSON.parse(plain) as BudgetPlaintext;
}
