import { authenticator } from "otplib";

authenticator.options = { window: 1, digits: 6 };

const ISSUER = "Budget Planner";

export function generateTotpSecret(username: string) {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(username, ISSUER, secret);
  return { secret, otpauthUrl };
}

export function verifyTotp(secret: string, code: string): boolean {
  const trimmed = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(trimmed)) return false;
  return authenticator.check(trimmed, secret);
}
