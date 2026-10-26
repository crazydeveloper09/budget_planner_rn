import * as SecureStore from "expo-secure-store";
import { uploadUserWrap } from "../api/auth";
import { bytesToHex, hexToBytes } from "./bytes";
import { randomDek } from "./e2e";

const DEK_KEY = "bp_e2e_dek";
const USER_WRAP_KEY = "bp_e2e_user_wrap";

export async function loadDek(): Promise<Uint8Array | null> {
  const raw = await SecureStore.getItemAsync(DEK_KEY);
  if (!raw) return null;
  return hexToBytes(raw);
}

export async function saveDek(dek: Uint8Array): Promise<void> {
  await SecureStore.setItemAsync(DEK_KEY, bytesToHex(dek));
}

export async function saveUserWrap(wrap: { salt: string; wrappedDek: string }): Promise<void> {
  await SecureStore.setItemAsync(USER_WRAP_KEY, JSON.stringify(wrap));
}

export async function flushUserWrap(): Promise<void> {
  const raw = await SecureStore.getItemAsync(USER_WRAP_KEY);
  if (!raw) return;
  const wrap = JSON.parse(raw) as { salt: string; wrappedDek: string };
  await uploadUserWrap(wrap);
}

export async function clearDek(): Promise<void> {
  await SecureStore.deleteItemAsync(DEK_KEY);
  await SecureStore.deleteItemAsync(USER_WRAP_KEY);
}

export async function requireDek(): Promise<Uint8Array> {
  const existing = await loadDek();
  if (existing) return existing;
  const dek = randomDek();
  await saveDek(dek);
  return dek;
}
