import jwt from "jsonwebtoken";
import { config } from "../config.js";

export type TokenPurpose = "access" | "totp_setup" | "totp_challenge";

export type TokenPayload = {
  sub: string;
  purpose: TokenPurpose;
  role: "owner" | "member";
  householdId: string | null;
};

export function signToken(
  payload: TokenPayload,
  expiresIn: jwt.SignOptions["expiresIn"]
): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

export function signAccessToken(user: {
  _id: unknown;
  role: "owner" | "member";
  householdId?: unknown;
}) {
  return signToken(
    {
      sub: String(user._id),
      purpose: "access",
      role: user.role,
      householdId: user.householdId ? String(user.householdId) : null,
    },
    "30d"
  );
}

export function verifyToken(token: string, purpose: TokenPurpose): TokenPayload {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("invalid");
  }
  const payload = decoded as TokenPayload;
  if (payload.purpose !== purpose || !payload.sub) {
    throw new Error("invalid");
  }
  return payload;
}
