import bcrypt from "bcrypt";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { encrypt, decrypt } from "../lib/crypto.js";
import { publicE2e, publicHousehold, publicUser } from "../lib/public.js";
import { signToken, verifyToken } from "../lib/tokens.js";
import { generateTotpSecret, verifyTotp } from "../lib/totp.js";
import { Household } from "../models/Household.js";
import { User } from "../models/User.js";

const router = Router();

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: "Zbyt wiele prób. Spróbuj za chwilę." },
});

const USERNAME_RE = /^[a-zA-Z0-9._]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!USERNAME_RE.test(trimmed)) return null;
  return trimmed;
}

function normalizePassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length < 8 || value.length > 72) return null;
  return value;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed) || trimmed.length > 120) return null;
  return trimmed;
}

async function householdFor(user: InstanceType<typeof User>) {
  if (!user.householdId) return null;
  return Household.findById(user.householdId);
}

function totpPayload(username: string, secret: string, otpauthUrl: string, setupToken: string) {
  return {
    setupToken,
    totp: {
      secret,
      otpauthUrl,
    },
  };
}

router.post("/register", authLimit, async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = normalizePassword(req.body?.password);
  const passwordConfirm = typeof req.body?.passwordConfirm === "string" ? req.body.passwordConfirm : "";
  const email = normalizeEmail(req.body?.email);
  const displayName =
    typeof req.body?.displayName === "string" && req.body.displayName.trim().length >= 2
      ? req.body.displayName.trim()
      : null;
  const inviteCode =
    typeof req.body?.inviteCode === "string" ? req.body.inviteCode.trim().toUpperCase() : "";

  if (!username || !password || !email || !displayName) {
    res.status(400).json({
      error: "Imię, nazwa użytkownika, e-mail i hasło (min. 8 znaków) są wymagane.",
    });
    return;
  }
  if (password !== passwordConfirm) {
    res.status(400).json({ error: "Hasła nie są takie same." });
    return;
  }

  const existing = await User.findOne({
    $or: [{ usernameLower: username.toLowerCase() }, { emailLower: email }],
  });
  if (existing) {
    res.status(409).json({
      error:
        existing.usernameLower === username.toLowerCase()
          ? "Ta nazwa użytkownika jest już zajęta."
          : "Ten e-mail jest już zajęty.",
    });
    return;
  }

  let role: "owner" | "member" = "owner";
  let householdId = null;
  let familyMemberName: string | null = null;
  if (inviteCode) {
    let household = await Household.findOne({ "people.inviteCode": inviteCode });
    const invitedPerson = household?.people.find((person) => person.inviteCode === inviteCode);
    if (household && invitedPerson?.linkedUserId) {
      res.status(400).json({ error: "Ten kod zaproszenia został już wykorzystany." });
      return;
    }
    if (!household) {
      household = await Household.findOne({ inviteCode });
    }
    if (!household) {
      res.status(400).json({ error: "Nieprawidłowy kod zaproszenia." });
      return;
    }
    role = "member";
    householdId = household._id;
    familyMemberName = invitedPerson?.name ?? null;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const { secret, otpauthUrl } = generateTotpSecret(username);
  const user = await User.create({
    username,
    usernameLower: username.toLowerCase(),
    email,
    emailLower: email,
    passwordHash,
    displayName,
    role,
    householdId,
    totpSecretEnc: encrypt(secret),
    totpEnabled: false,
    familyMemberName,
  });

  if (inviteCode && familyMemberName && householdId) {
    await Household.updateOne(
      { _id: householdId, "people.inviteCode": inviteCode },
      { $set: { "people.$.linkedUserId": user._id } }
    );
  }

  const setupToken = signToken(
    { sub: String(user._id), purpose: "totp_setup", role: user.role, householdId: householdId ? String(householdId) : null },
    "15m"
  );

  res.status(201).json(totpPayload(username, secret, otpauthUrl, setupToken));
});

router.post("/login", authLimit, async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!username || !password) {
    res.status(400).json({ error: "Podaj nazwę użytkownika i hasło." });
    return;
  }

  const user = await User.findOne({ usernameLower: username.toLowerCase() });
  if (!user) {
    res.status(401).json({ error: "Nieprawidłowa nazwa użytkownika lub hasło." });
    return;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Nieprawidłowa nazwa użytkownika lub hasło." });
    return;
  }

  if (!user.totpEnabled || !user.totpSecretEnc) {
    const { secret, otpauthUrl } = generateTotpSecret(user.username);
    user.totpSecretEnc = encrypt(secret);
    await user.save();
    const setupToken = signToken(
      {
        sub: String(user._id),
        purpose: "totp_setup",
        role: user.role,
        householdId: user.householdId ? String(user.householdId) : null,
      },
      "15m"
    );
    res.json({ requiresSetup: true, ...totpPayload(user.username, secret, otpauthUrl, setupToken) });
    return;
  }

  const challengeToken = signToken(
    {
      sub: String(user._id),
      purpose: "totp_challenge",
      role: user.role,
      householdId: user.householdId ? String(user.householdId) : null,
    },
    "5m"
  );
  res.json({ requiresSetup: false, challengeToken });
});

router.post("/2fa/confirm", authLimit, async (req, res) => {
  const token = typeof req.body?.setupToken === "string" ? req.body.setupToken : "";
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  try {
    const payload = verifyToken(token, "totp_setup");
    const user = await User.findById(payload.sub);
    if (!user?.totpSecretEnc) {
      res.status(400).json({ error: "Nie można dokończyć konfiguracji 2FA." });
      return;
    }
    const secret = decrypt(user.totpSecretEnc);
    if (!verifyTotp(secret, code)) {
      res.status(401).json({ error: "Nieprawidłowy kod 2FA." });
      return;
    }
    user.totpEnabled = true;
    await user.save();
    const household = await householdFor(user);
    const accessToken = signToken(
      {
        sub: String(user._id),
        purpose: "access",
        role: user.role,
        householdId: user.householdId ? String(user.householdId) : null,
      },
      "30d"
    );
    res.json({
      accessToken,
      user: publicUser(user),
      household: household ? publicHousehold(household, { includeInvite: user.role === "owner" }) : null,
      e2e: household ? publicE2e(household, user) : null,
    });
  } catch {
    res.status(401).json({ error: "Sesja konfiguracji 2FA wygasła. Zaloguj się ponownie." });
  }
});

router.post("/2fa/verify", authLimit, async (req, res) => {
  const token = typeof req.body?.challengeToken === "string" ? req.body.challengeToken : "";
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  try {
    const payload = verifyToken(token, "totp_challenge");
    const user = await User.findById(payload.sub);
    if (!user?.totpEnabled || !user.totpSecretEnc) {
      res.status(400).json({ error: "To konto nie ma włączonego 2FA." });
      return;
    }
    const secret = decrypt(user.totpSecretEnc);
    if (!verifyTotp(secret, code)) {
      res.status(401).json({ error: "Nieprawidłowy kod 2FA." });
      return;
    }
    const household = await householdFor(user);
    const accessToken = signToken(
      {
        sub: String(user._id),
        purpose: "access",
        role: user.role,
        householdId: user.householdId ? String(user.householdId) : null,
      },
      "30d"
    );
    res.json({
      accessToken,
      user: publicUser(user),
      household: household ? publicHousehold(household, { includeInvite: user.role === "owner" }) : null,
      e2e: household ? publicE2e(household, user) : null,
    });
  } catch {
    res.status(401).json({ error: "Sesja logowania wygasła. Spróbuj od nowa." });
  }
});

export default router;
