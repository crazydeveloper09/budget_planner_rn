import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/tokens.js";
import { User } from "../models/User.js";

export type AuthedRequest = Request & {
  userId: string;
  role: "owner" | "member";
  householdId: string | null;
};

export async function requireAccess(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Brak sesji. Zaloguj się ponownie." });
    return;
  }

  try {
    const payload = verifyToken(token, "access");
    const user = await User.findById(payload.sub);
    if (!user || !user.totpEnabled) {
      res.status(401).json({ error: "Brak sesji. Zaloguj się ponownie." });
      return;
    }
    const authed = req as AuthedRequest;
    authed.userId = String(user._id);
    authed.role = user.role;
    authed.householdId = user.householdId ? String(user.householdId) : null;
    next();
  } catch {
    res.status(401).json({ error: "Sesja wygasła. Zaloguj się ponownie." });
  }
}
