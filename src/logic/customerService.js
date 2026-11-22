// Customer, purchase and reward rules. Every function is pure: it takes the
// current data and returns a result plus the NEW data. Nothing here touches
// the browser, so the same rules can move to a server in Phase 3.
//
// Stored per customer: id, name, mobile_number, created_at.
// current_stamps and completed_cards are DERIVED from the purchase list
// (see cardStatus), so they can never drift, go negative or be edited alone.
import { REWARD_STATUS, STAMPS_PER_CARD, cardStatus, isValidMobile, normalizeMobile, usualDrink } from "./loyalty.js";

const uid = (prefix) => {
  const r = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${r.replace(/-/g, "").slice(0, 12)}`;
};

export const emptyState = () => ({ version: 1, customers: [], purchases: [], rewards: [] });

export const cleanName = (name) =>
  String(name ?? "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);

function checkMobile(raw) {
  const mobile = normalizeMobile(raw);
  if (!mobile) return { ok: false, code: "empty", message: "Enter your mobile number." };
  if (!isValidMobile(mobile)) {
    return { ok: false, code: "invalid", message: "Enter an 11-digit mobile number that starts with 09." };
  }
  return { ok: true, mobile };
}

export const findCustomer = (state, mobile) =>
  state.customers.find((c) => c.mobile_number === mobile) || null;

export function lookupCustomer(state, raw) {
  const m = checkMobile(raw);
  if (!m.ok) return m;
  const customer = findCustomer(state, m.mobile);
  if (!customer) return { ok: false, code: "not_found", mobile: m.mobile, message: "No card found for that number yet." };
  return { ok: true, customer };
}

export function enrollCustomer(state, { mobile: raw, name }) {
  const m = checkMobile(raw);
  if (!m.ok) return m;
  const existing = findCustomer(state, m.mobile);
  if (existing) {
    return { ok: false, code: "duplicate", message: "A card already exists for that number. Load it instead." };
  }
  const customer = { id: uid("cus"), name: cleanName(name), mobile_number: m.mobile, created_at: new Date().toISOString() };
  return { ok: true, customer, state: { ...state, customers: [...state.customers, customer] } };
}

export const purchasesFor = (state, customerId) =>
  state.purchases
    .filter((p) => p.customer_id === customerId && p.redeemed_at)
    .sort((a, b) => Date.parse(b.purchased_at) - Date.parse(a.purchased_at));

export const rewardsFor = (state, customerId) =>
  state.rewards.filter((r) => r.customer_id === customerId).sort((a, b) => a.card_number - b.card_number);

// Adds exactly one stamp for one purchase code. A code that is already on
// file is rejected, so one purchase can never give two stamps.
// PHASE 1 DEMO PATH: Phase 3 moves this call to a server that verifies the code.
export function recordRedeemedPurchase(state, { customerId, drinkId, drinkName, code, purchasedAt, redeemedAt }) {
  const customer = state.customers.find((c) => c.id === customerId);
  if (!customer) return { ok: false, code: "no_customer", message: "Load your loyalty card first." };
  if (!code) return { ok: false, code: "no_code", message: "That code isn't valid." };
  if (state.purchases.some((p) => p.purchase_code === code)) {
    return { ok: false, code: "duplicate_code", message: "That code has already been used." };
  }
  const redeemed = redeemedAt ?? new Date().toISOString();
  const purchase = {
    id: uid("pur"),
    customer_id: customerId,
    drink_id: drinkId,
    drink_name: drinkName,
    purchase_code: code,
    purchased_at: purchasedAt ?? redeemed,
    redeemed_at: redeemed,
  };
  const purchases = [...state.purchases, purchase];
  const total = purchases.filter((p) => p.customer_id === customerId && p.redeemed_at).length;
  let rewards = state.rewards;
  let rewardEarned = false;
  if (total % STAMPS_PER_CARD === 0) {
    rewardEarned = true;
    rewards = [
      ...rewards,
      { id: uid("rew"), customer_id: customerId, card_number: total / STAMPS_PER_CARD, reward_status: REWARD_STATUS.EARNED, earned_at: redeemed, redeemed_at: null },
    ];
  }
  return { ok: true, purchase, rewardEarned, state: { ...state, purchases, rewards } };
}

// Staff marks the oldest waiting free drink as given.
export function giveReward(state, customerId, now = new Date().toISOString()) {
  const waiting = rewardsFor(state, customerId).find((r) => r.reward_status === REWARD_STATUS.EARNED);
  if (!waiting) return { ok: false, code: "none", message: "No free drink is waiting for this customer." };
  const rewards = state.rewards.map((r) =>
    r.id === waiting.id ? { ...r, reward_status: REWARD_STATUS.REDEEMED, redeemed_at: now } : r
  );
  return { ok: true, reward: waiting, state: { ...state, rewards } };
}

// Everything the loyalty card needs, derived from the stored records.
export function customerSummary(state, customer) {
  const purchases = purchasesFor(state, customer.id);
  const rewards = rewardsFor(state, customer.id);
  return {
    customer,
    purchases,
    rewards,
    status: cardStatus(purchases.length),
    usual: usualDrink(purchases),
    waitingRewards: rewards.filter((r) => r.reward_status === REWARD_STATUS.EARNED).length,
  };
}
