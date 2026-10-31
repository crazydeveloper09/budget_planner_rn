import * as SecureStore from "expo-secure-store";
import { dekKey, wrapKey } from "../auth/profileSession";
import { uploadUserWrap } from "../api/auth";
import { bytesToHex, hexToBytes } from "./bytes";
import { randomDek } from "./e2e";

export async function loadDek(): Promise<Uint8Array | null> {
  const raw = await SecureStore.getItemAsync(dekKey());
  if (!raw) return null;
  return hexToBytes(raw);
}

export async function saveDek(dek: Uint8Array): Promise<void> {
  await SecureStore.setItemAsync(dekKey(), bytesToHex(dek));
}

export async function saveUserWrap(wrap: { salt: string; wrappedDek: string }): Promise<void> {
  await SecureStore.setItemAsync(wrapKey(), JSON.stringify(wrap));
}

export async function flushUserWrap(): Promise<void> {
  const raw = await SecureStore.getItemAsync(wrapKey());
  if (!raw) return;
  const wrap = JSON.parse(raw) as { salt: string; wrappedDek: string };
  await uploadUserWrap(wrap);
}

export async function clearDek(): Promise<void> {
  await SecureStore.deleteItemAsync(dekKey());
  await SecureStore.deleteItemAsync(wrapKey());
}

export async function requireDek(): Promise<Uint8Array> {
  const existing = await loadDek();
  if (existing) return existing;
  const dek = randomDek();
  await saveDek(dek);
  return dek;
}
