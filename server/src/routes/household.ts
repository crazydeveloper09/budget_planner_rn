import { Router } from "express";
import mongoose from "mongoose";
import { randomInviteCode } from "../lib/crypto.js";
import { publicE2e, publicEntries, publicHousehold, publicPeople, publicRecurring, publicUser } from "../lib/public.js";
import { requireAccess, type AuthedRequest } from "../middleware/auth.js";
import { Household } from "../models/Household.js";
import { User } from "../models/User.js";

const router = Router();
const ACCOUNT_TYPES = ["personal", "business", "family"] as const;

async function uniqueInviteCode() {
  for (let i = 0; i < 8; i += 1) {
    const inviteCode = randomInviteCode();
    const exists = await Household.findOne({
      $or: [{ inviteCode }, { "people.inviteCode": inviteCode }],
    });
    if (!exists) return inviteCode;
  }
  throw new Error("invite");
}

function snapshot(
  household: InstanceType<typeof Household>,
  includeInvite: boolean,
  user?: InstanceType<typeof User> | null
) {
  return {
    household: publicHousehold(household, { includeInvite }),
    people: publicPeople(household, { includeInvite }),
    recurring: publicRecurring(household),
    entries: publicEntries(household),
    e2e: user ? publicE2e(household, user) : null,
  };
}

function ensureE2e(household: InstanceType<typeof Household>) {
  if (!household.e2e) {
    household.e2e = { version: 0, nonce: "", ciphertext: "", wraps: [] };
  }
  if (!household.e2e.wraps) household.e2e.wraps = [];
  return household.e2e;
}

router.get("/me", requireAccess, async (req, res) => {
  const authed = req as AuthedRequest;
  const user = await User.findById(authed.userId);
  if (!user) {
    res.status(401).json({ error: "Brak sesji. Zaloguj się ponownie." });
    return;
  }
  const household = user.householdId ? await Household.findById(user.householdId) : null;
  const members = household
    ? await User.find({ householdId: household._id, totpEnabled: true }).select(
        "username displayName role familyMemberName"
      )
    : [];
  const includeInvite = user.role === "owner";
  res.json({
    user: publicUser(user),
    household: household ? publicHousehold(household, { includeInvite }) : null,
    members: members.map((member) => ({
      id: String(member._id),
      username: member.username,
      displayName: member.familyMemberName || member.displayName,
      role: member.role,
    })),
    people: household ? publicPeople(household, { includeInvite }) : [],
    recurring: household ? publicRecurring(household) : [],
    entries: household ? publicEntries(household) : [],
    e2e: household ? publicE2e(household, user) : null,
  });
});

router.get("/households/snapshot", requireAccess, async (req, res) => {
  const authed = req as AuthedRequest;
  if (!authed.householdId) {
    res.status(404).json({ error: "Brak powiązanego budżetu w chmurze." });
    return;
  }
  const household = await Household.findById(authed.householdId);
  if (!household) {
    res.status(404).json({ error: "Nie znaleziono konta w chmurze." });
    return;
  }
  const user = await User.findById(authed.userId);
  res.json(snapshot(household, authed.role === "owner", user));
});

router.post("/households", requireAccess, async (req, res) => {
  const authed = req as AuthedRequest;
  const user = await User.findById(authed.userId);
  if (!user) {
    res.status(401).json({ error: "Brak sesji. Zaloguj się ponownie." });
    return;
  }
  if (user.role !== "owner") {
    res.status(403).json({ error: "Tylko konto główne może utworzyć budżet w chmurze." });
    return;
  }
  if (user.householdId) {
    const existing = await Household.findById(user.householdId);
    res.json({ household: existing ? publicHousehold(existing, { includeInvite: true }) : null });
    return;
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const accountType = ACCOUNT_TYPES.includes(req.body?.accountType) ? req.body.accountType : null;
  if (name.length < 2 || !accountType) {
    res.status(400).json({ error: "Podaj nazwę i rodzaj konta." });
    return;
  }

  const household = await Household.create({
    name,
    accountType,
    ownerId: user._id,
    inviteCode: await uniqueInviteCode(),
    dailySaldo: 100,
    people: [],
    recurring: [],
    entries: [],
  });
  user.householdId = household._id;
  await user.save();
  res.status(201).json({ household: publicHousehold(household, { includeInvite: true }) });
});

router.put("/households/snapshot", requireAccess, async (req, res) => {
  const authed = req as AuthedRequest;
  if (authed.role !== "owner" || !authed.householdId) {
    res.status(403).json({ error: "Tylko konto główne może zapisać budżet rodziny." });
    return;
  }
  const household = await Household.findById(authed.householdId);
  if (!household) {
    res.status(404).json({ error: "Nie znaleziono konta w chmurze." });
    return;
  }

  const incomingPeople = Array.isArray(req.body?.people) ? req.body.people : [];
  const incomingEntries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  const incomingRecurring = Array.isArray(req.body?.recurring) ? req.body.recurring : [];
  const e2eBody = req.body?.e2e;
  const hasCipher =
    e2eBody &&
    typeof e2eBody.ciphertext === "string" &&
    e2eBody.ciphertext.length > 0 &&
    typeof e2eBody.nonce === "string" &&
    e2eBody.nonce.length > 0;

  if (typeof req.body?.profile?.name === "string" && req.body.profile.name.trim().length > 1) {
    household.name = req.body.profile.name.trim();
  }
  if (typeof req.body?.profile?.dailySaldo === "number") {
    household.dailySaldo = req.body.profile.dailySaldo;
  }

  household.people = incomingPeople
    .filter((person: { name?: string }) => typeof person.name === "string" && person.name.trim().length > 1)
    .map((person: { name: string; role?: string; dailySaldo?: number | null; salary?: number | null }) => {
      const name = person.name.trim();
      const previous = household.people.find((item) => item.name === name);
      return {
        name,
        role: person.role === "employee" ? "employee" : "family",
        dailySaldo: hasCipher ? null : typeof person.dailySaldo === "number" ? person.dailySaldo : null,
        salary: hasCipher ? null : typeof person.salary === "number" ? person.salary : null,
        inviteCode: previous?.inviteCode ?? null,
        linkedUserId: previous?.linkedUserId ?? null,
      };
    });

  if (hasCipher) {
    const e2e = ensureE2e(household);
    e2e.version = 1;
    e2e.nonce = e2eBody.nonce;
    e2e.ciphertext = e2eBody.ciphertext;
    household.entries = [];
    household.recurring = [];
    household.markModified("e2e");
  } else {
    household.entries = incomingEntries
      .filter((item: { category?: string; amount?: number; date?: string }) =>
        typeof item.category === "string" && typeof item.amount === "number" && typeof item.date === "string"
      )
      .map((item: { date: string; type?: string; name?: string; category: string; amount: number; regular?: boolean; ownerName?: string | null }) => ({
        entryDate: item.date,
        entryKind: item.type === "income" ? "income" : "expense",
        title: typeof item.name === "string" ? item.name : "",
        category: item.category,
        amount: item.amount,
        isRegular: Boolean(item.regular),
        ownerName: typeof item.ownerName === "string" && item.ownerName.trim() ? item.ownerName.trim() : null,
      }));

    household.recurring = (household.entries.length > 0
      ? household.entries.filter((item) => item.isRegular)
      : incomingRecurring
          .filter((item: { category?: string; amount?: number }) => typeof item.category === "string" && typeof item.amount === "number")
          .map((item: { type?: string; name?: string; category: string; amount: number; ownerName?: string | null }) => ({
            entryKind: item.type === "income" ? "income" : "expense",
            title: typeof item.name === "string" ? item.name : "",
            category: item.category,
            amount: item.amount,
            isRegular: true,
            ownerName: typeof item.ownerName === "string" && item.ownerName.trim() ? item.ownerName.trim() : null,
          }))
    ).map((item) => ({
      entryKind: item.entryKind,
      title: item.title,
      category: item.category,
      amount: item.amount,
      ownerName: item.ownerName,
    }));
  }

  const user = await User.findById(authed.userId);
  await household.save();
  res.json(snapshot(household, true, user));
});

router.post("/e2e/wraps", requireAccess, async (req, res) => {
  const authed = req as AuthedRequest;
  if (!authed.householdId) {
    res.status(404).json({ error: "Brak powiązanego budżetu w chmurze." });
    return;
  }
  const salt = typeof req.body?.salt === "string" ? req.body.salt : "";
  const wrappedDek = typeof req.body?.wrappedDek === "string" ? req.body.wrappedDek : "";
  if (salt.length < 16 || wrappedDek.length < 32) {
    res.status(400).json({ error: "Niepoprawny pakiet klucza." });
    return;
  }
  const household = await Household.findById(authed.householdId);
  if (!household) {
    res.status(404).json({ error: "Nie znaleziono konta w chmurze." });
    return;
  }
  const e2e = ensureE2e(household);
  const kind = req.body?.kind === "invite" && authed.role === "owner" ? "invite" : "user";
  if (kind === "invite") {
    const inviteCode =
      typeof req.body?.inviteCode === "string" ? req.body.inviteCode.trim().toUpperCase() : "";
    if (!inviteCode) {
      res.status(400).json({ error: "Brak kodu zaproszenia." });
      return;
    }
    const wrap = { kind: "invite" as const, userId: null, inviteCode, salt, wrappedDek };
    const idx = e2e.wraps.findIndex((item) => item.kind === "invite" && item.inviteCode === inviteCode);
    if (idx >= 0) e2e.wraps[idx] = wrap;
    else e2e.wraps.push(wrap);
  } else {
    const wrap = {
      kind: "user" as const,
      userId: new mongoose.Types.ObjectId(authed.userId),
      inviteCode: null,
      salt,
      wrappedDek,
    };
    const idx = e2e.wraps.findIndex((item) => item.kind === "user" && String(item.userId) === authed.userId);
    if (idx >= 0) e2e.wraps[idx] = wrap;
    else e2e.wraps.push(wrap);
    const person = household.people.find((item) => String(item.linkedUserId) === authed.userId);
    if (person?.inviteCode) {
      e2e.wraps = e2e.wraps.filter((item) => !(item.kind === "invite" && item.inviteCode === person.inviteCode));
    }
  }
  household.markModified("e2e");
  await household.save();
  res.json({ ok: true });
});

router.post("/households/invites", requireAccess, async (req, res) => {
  const authed = req as AuthedRequest;
  if (authed.role !== "owner" || !authed.householdId) {
    res.status(403).json({ error: "Tylko konto główne może zapraszać członków rodziny." });
    return;
  }
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (name.length < 2) {
    res.status(400).json({ error: "Wybierz członka rodziny." });
    return;
  }
  const household = await Household.findById(authed.householdId);
  if (!household) {
    res.status(404).json({ error: "Nie znaleziono konta w chmurze." });
    return;
  }
  const person = household.people.find((item) => item.name === name);
  if (!person) {
    res.status(404).json({ error: "Najpierw dodaj tę osobę do rodziny." });
    return;
  }
  if (person.linkedUserId) {
    res.status(409).json({ error: "Ta osoba ma już konto w aplikacji." });
    return;
  }
  person.inviteCode = await uniqueInviteCode();
  await household.save();
  res.json({
    name: person.name,
    inviteCode: person.inviteCode,
    people: publicPeople(household, { includeInvite: true }),
  });
});

router.post("/households/invite/rotate", requireAccess, async (req, res) => {
  const authed = req as AuthedRequest;
  if (authed.role !== "owner" || !authed.householdId) {
    res.status(403).json({ error: "Tylko konto główne może odświeżyć kod zaproszenia." });
    return;
  }
  const household = await Household.findById(authed.householdId);
  if (!household) {
    res.status(404).json({ error: "Nie znaleziono konta w chmurze." });
    return;
  }
  household.inviteCode = await uniqueInviteCode();
  await household.save();
  res.json({ household: publicHousehold(household, { includeInvite: true }) });
});

export default router;
