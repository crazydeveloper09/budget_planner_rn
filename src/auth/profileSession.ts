import * as SecureStore from "expo-secure-store";

const LEGACY_TOKEN = "bp_access_token";
const LEGACY_SESSION = "bp_session";
const LEGACY_DEK = "bp_e2e_dek";
const LEGACY_WRAP = "bp_e2e_user_wrap";

let boundId: number | null = null;

export function boundProfileId() {
  return boundId;
}

export function tokenKey(profileId = boundId) {
  return profileId == null ? LEGACY_TOKEN : `bp_access_token_p${profileId}`;
}

export function sessionKey(profileId = boundId) {
  return profileId == null ? LEGACY_SESSION : `bp_session_p${profileId}`;
}

export function dekKey(profileId = boundId) {
  return profileId == null ? LEGACY_DEK : `bp_e2e_dek_p${profileId}`;
}

export function wrapKey(profileId = boundId) {
  return profileId == null ? LEGACY_WRAP : `bp_e2e_user_wrap_p${profileId}`;
}

export async function hasStoredSession(profileId: number): Promise<boolean> {
  const token = await SecureStore.getItemAsync(tokenKey(profileId));
  return Boolean(token);
}

async function copyIfMissing(from: string, to: string) {
  const existing = await SecureStore.getItemAsync(to);
  if (existing) return;
  const legacy = await SecureStore.getItemAsync(from);
  if (!legacy) return;
  await SecureStore.setItemAsync(to, legacy);
}

export async function migrateLegacySession(profileId: number) {
  await copyIfMissing(LEGACY_TOKEN, tokenKey(profileId));
  await copyIfMissing(LEGACY_SESSION, sessionKey(profileId));
  await copyIfMissing(LEGACY_DEK, dekKey(profileId));
  await copyIfMissing(LEGACY_WRAP, wrapKey(profileId));
}

export function setBoundProfileId(profileId: number | null) {
  boundId = profileId;
}

export async function clearProfileSession(profileId: number) {
  await SecureStore.deleteItemAsync(tokenKey(profileId));
  await SecureStore.deleteItemAsync(sessionKey(profileId));
  await SecureStore.deleteItemAsync(dekKey(profileId));
  await SecureStore.deleteItemAsync(wrapKey(profileId));
}
