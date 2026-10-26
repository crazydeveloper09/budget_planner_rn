import { fetchMe } from "../api/auth";
import { E2eWrap } from "../api/types";
import { randomDek, unwrapDek, wrapDek } from "./e2e";
import { flushUserWrap, loadDek, saveDek, saveUserWrap } from "./keystore";

async function tryUnwrap(wraps: E2eWrap[], secrets: string[]): Promise<Uint8Array | null> {
  for (const wrap of wraps) {
    for (const secret of secrets) {
      if (!secret) continue;
      try {
        return await unwrapDek(wrap, secret);
      } catch {
        // wrong secret for this wrap
      }
    }
  }
  return null;
}

export async function unlockE2e(input: { password: string; inviteCode?: string }): Promise<boolean> {
  let dek = await loadDek();
  const invite = input.inviteCode?.trim().toUpperCase() ?? "";
  const secrets = [input.password, invite].filter(Boolean);
  let role: "owner" | "member" | null = null;

  try {
    const me = await fetchMe();
    role = me.user.role;
    const wraps = me.e2e?.wraps ?? [];
    if (!dek && wraps.length > 0) {
      dek = await tryUnwrap(wraps, secrets);
    }
    if (!dek && role === "owner") {
      dek = randomDek();
    }
  } catch {
    // sieć padła po 2FA — bez roli nie zgadujemy klucza członka
  }

  if (!dek) return false;
  await saveDek(dek);
  try {
    const userWrap = await wrapDek(dek, input.password);
    await saveUserWrap({ salt: userWrap.salt, wrappedDek: userWrap.wrappedDek });
    await flushUserWrap();
  } catch {
    // gospodarstwo może jeszcze nie istnieć
  }
  return true;
}
