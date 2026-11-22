import { MENU } from "../data/menu.js";
import { SHOP } from "../data/shop.js";

export const STAMPS_PER_CARD = SHOP.stampsPerCard;
export const CODE_TTL_MS = 15 * 60 * 1000; // demo expiry: 15 minutes (Phase 3 moves this to the server)

// Matches the 4-digit codes in the reference design. Production codes
// should be longer, rate-limited and checked on the server.
export const CODE_LENGTH = 4;

export const REWARD_STATUS = { EARNED: "earned", REDEEMED: "redeemed" };

export const drinkById = (id) => MENU.find((m) => m.id === id);

/* ---------- Mobile numbers ---------- */

// Accepts 09XXXXXXXXX, 9XXXXXXXXX is NOT accepted, +639XXXXXXXXX and 639XXXXXXXXX
// are converted to the local 09 format so one person is never stored twice.
export function normalizeMobile(value) {
  const v = String(value ?? "").replace(/[\s()-]/g, "");
  const intl = v.match(/^\+?63(9\d{9})$/);
  return intl ? `0${intl[1]}` : v;
}
export const isValidMobile = (v) => /^09\d{9}$/.test(v);

// 09123456789 -> "0912 ••• 6789" (shown on screen instead of the full number)
export const maskMobile = (m) => (m && m.length === 11 ? `${m.slice(0, 4)} ••• ${m.slice(7)}` : "");

/* ---------- Stamp rules ---------- */

// Single source of truth: the number of redeemed purchases.
// 0 -> 0/10, 1 -> 1/10, 10 -> 10/10 (complete), 11 -> 1/10 of the next card.
export function cardStatus(redeemedPurchaseCount) {
  const total = Math.max(0, Math.floor(Number(redeemedPurchaseCount) || 0));
  const currentStamps = total === 0 ? 0 : ((total - 1) % STAMPS_PER_CARD) + 1;
  return {
    total,
    currentStamps,
    completedCards: Math.floor(total / STAMPS_PER_CARD),
    complete: total > 0 && currentStamps === STAMPS_PER_CARD,
    remaining: STAMPS_PER_CARD - currentStamps,
  };
}

/* ---------- Usual drink ---------- */

// Most purchased drink over the customer's whole history.
// Tie-break (always the same): the tied drink bought most recently wins;
// if that is also equal, the name that comes first alphabetically wins.
export function usualDrink(purchases) {
  const byDrink = new Map();
  for (const p of purchases) {
    const key = p.drink_id || p.drink_name;
    const at = Date.parse(p.purchased_at) || 0;
    const e = byDrink.get(key) || { name: p.drink_name, count: 0, last: 0 };
    e.count += 1;
    e.last = Math.max(e.last, at);
    byDrink.set(key, e);
  }
  const ranked = [...byDrink.values()].sort(
    (a, b) => b.count - a.count || b.last - a.last || a.name.localeCompare(b.name)
  );
  return ranked[0] ? { name: ranked[0].name, count: ranked[0].count } : null;
}

/* ---------- Phase 1 demo codes (replaced by the server in Phase 3) ---------- */

function randomCode(length = CODE_LENGTH) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b % 10).join("");
}

export function issueCode(codes, drinkId, now = Date.now()) {
  let code = randomCode();
  while (codes.some((c) => c.code === code)) code = randomCode();
  return { code, drinkId, issuedAt: now, expiresAt: now + CODE_TTL_MS, redeemedAt: null };
}

export function checkCode(codes, input, now = Date.now()) {
  const entry = codes.find((c) => c.code === input.replace(/\s/g, ""));
  if (!entry) return { ok: false, message: "That code isn't valid. Check it with the staff." };
  if (entry.redeemedAt) return { ok: false, message: "That code has already been used." };
  if (now > entry.expiresAt) return { ok: false, message: "That code has expired. Ask staff for a new one." };
  return { ok: true, entry };
}
