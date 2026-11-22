import test from "node:test";
import assert from "node:assert/strict";
import { cardStatus, isValidMobile, maskMobile, normalizeMobile, usualDrink } from "../src/logic/loyalty.js";
import {
  customerSummary, emptyState, enrollCustomer, giveReward, lookupCustomer, recordRedeemedPurchase,
} from "../src/logic/customerService.js";
import { buildSeedState } from "../src/data/customers.js";

const buy = (state, customerId, n, drinkId = "spanish-latte", prefix = "T") => {
  let s = state;
  for (let i = 0; i < n; i++) {
    const r = recordRedeemedPurchase(s, { customerId, drinkId, drinkName: drinkId, code: `${prefix}${s.purchases.length}` });
    assert.ok(r.ok);
    s = r.state;
  }
  return s;
};
const withCustomer = () => {
  const r = enrollCustomer(emptyState(), { mobile: "09123456789", name: "Ana" });
  return { state: r.state, id: r.customer.id };
};

test("mobile numbers: validation and normalization", () => {
  assert.equal(normalizeMobile("0912 345-6789"), "09123456789");
  assert.equal(normalizeMobile("+639123456789"), "09123456789");
  assert.equal(normalizeMobile("639123456789"), "09123456789");
  assert.ok(isValidMobile("09123456789"));
  for (const bad of ["", "123", "0812345678", "091234567890", "abcdefghijk"]) assert.ok(!isValidMobile(normalizeMobile(bad)), bad);
  assert.equal(maskMobile("09123456789"), "0912 ••• 6789");
});

test("cardStatus: 0, 1, 9, 10, 11 and 20 stamps", () => {
  const at = (n) => { const s = cardStatus(n); return [s.currentStamps, s.completedCards, s.complete, s.remaining]; };
  assert.deepEqual(at(0), [0, 0, false, 10]);
  assert.deepEqual(at(1), [1, 0, false, 9]);
  assert.deepEqual(at(9), [9, 0, false, 1]);
  assert.deepEqual(at(10), [10, 1, true, 0]);
  assert.deepEqual(at(11), [1, 1, false, 9]);
  assert.deepEqual(at(20), [10, 2, true, 0]);
  assert.equal(cardStatus(-5).currentStamps, 0, "never negative");
});

test("usual drink: most frequent wins (5/2/1 example)", () => {
  const p = (drink, day) => ({ drink_id: drink, drink_name: drink, purchased_at: new Date(2026, 0, day).toISOString() });
  const list = [...[1, 2, 3, 4, 5].map((d) => p("macchiato", d)), p("spanish", 6), p("spanish", 7), p("pistachio", 8)];
  assert.equal(usualDrink(list).name, "macchiato");
  assert.equal(usualDrink([]), null);
});

test("usual drink: tie goes to the tied drink bought most recently", () => {
  const p = (drink, day) => ({ drink_id: drink, drink_name: drink, purchased_at: new Date(2026, 0, day).toISOString() });
  assert.equal(usualDrink([p("a", 1), p("b", 2), p("a", 3), p("b", 4)]).name, "b");
  assert.equal(usualDrink([p("a", 1), p("b", 2), p("b", 3), p("a", 4)]).name, "a");
});

test("lookup: empty, invalid, missing and existing customers", () => {
  const { state } = withCustomer();
  assert.equal(lookupCustomer(state, "").code, "empty");
  assert.equal(lookupCustomer(state, "12345").code, "invalid");
  const missing = lookupCustomer(state, "09999999999");
  assert.equal(missing.code, "not_found");
  assert.equal(missing.mobile, "09999999999");
  assert.ok(lookupCustomer(state, "+63 912 345 6789").ok, "international form finds the same customer");
});

test("enrollment: validates, cleans the name, never duplicates", () => {
  const { state } = withCustomer();
  assert.equal(enrollCustomer(state, { mobile: "nope" }).ok, false);
  const dup = enrollCustomer(state, { mobile: "+639123456789", name: "Other" });
  assert.equal(dup.code, "duplicate");
  assert.equal(state.customers.length, 1);
  const ok = enrollCustomer(state, { mobile: "09171234567", name: "  <b>Ben</b>   Cruz  " });
  assert.ok(ok.ok);
  assert.equal(ok.customer.name, "bBen/b Cruz", "angle brackets stripped, spaces collapsed");
});

test("purchases: one stamp each, duplicate codes rejected", () => {
  const { state, id } = withCustomer();
  const first = recordRedeemedPurchase(state, { customerId: id, drinkId: "x", drinkName: "X", code: "1111" });
  assert.ok(first.ok);
  const again = recordRedeemedPurchase(first.state, { customerId: id, drinkId: "x", drinkName: "X", code: "1111" });
  assert.equal(again.code, "duplicate_code");
  assert.equal(customerSummary(first.state, first.state.customers[0]).status.total, 1);
  assert.equal(recordRedeemedPurchase(state, { customerId: "nobody", code: "2222" }).code, "no_customer");
});

test("10th stamp completes the card and earns exactly one reward; history kept; 11th starts a new card", () => {
  const { state, id } = withCustomer();
  const nine = buy(state, id, 9);
  assert.equal(nine.rewards.length, 0);
  const ten = buy(nine, id, 1);
  assert.equal(ten.rewards.length, 1);
  assert.equal(ten.rewards[0].reward_status, "earned");
  let sum = customerSummary(ten, ten.customers[0]);
  assert.equal(sum.status.currentStamps, 10);
  assert.ok(sum.status.complete);
  assert.equal(sum.waitingRewards, 1);
  const eleven = buy(ten, id, 1);
  sum = customerSummary(eleven, eleven.customers[0]);
  assert.equal(sum.status.currentStamps, 1);
  assert.equal(sum.status.completedCards, 1);
  assert.equal(sum.purchases.length, 11, "history kept");
  assert.equal(eleven.rewards.length, 1, "no second reward yet");
  assert.equal(buy(eleven, id, 9).rewards.length, 2, "20th purchase earns the second reward");
});

test("rewards: staff can give one at a time, then none left", () => {
  const { state, id } = withCustomer();
  const ten = buy(state, id, 10);
  const given = giveReward(ten, id);
  assert.ok(given.ok);
  assert.equal(given.state.rewards[0].reward_status, "redeemed");
  assert.ok(given.state.rewards[0].redeemed_at);
  assert.equal(giveReward(given.state, id).code, "none");
});

test("seed data matches what the screens promise", () => {
  const s = buildSeedState();
  const by = (m) => { const c = s.customers.find((x) => x.mobile_number === m); return customerSummary(s, c); };
  assert.equal(by("09123456789").status.currentStamps, 1);
  assert.equal(by("09556667777").status.currentStamps, 0);
  assert.equal(by("09987654321").status.currentStamps, 9);
  assert.ok(by("09445556666").status.complete);
  assert.equal(by("09445556666").waitingRewards, 1);
  assert.equal(by("09334445555").usual.name, "Iced Caramel Macchiato");
  const faye = by("09223334444");
  assert.equal(faye.status.currentStamps, 2);
  assert.equal(faye.waitingRewards, 0);
  assert.equal(faye.rewards[0].reward_status, "redeemed");
  const codes = s.purchases.map((p) => p.purchase_code);
  assert.equal(new Set(codes).size, codes.length, "purchase codes are unique");
});

test("storage: saves, reloads, and recovers from corrupt data", async () => {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
  const { loadState, saveState, STORAGE_KEY, resetState } = await import("../src/data/store.js");
  const first = loadState();
  assert.ok(first.customers.length > 0, "seeded on first run");
  const enrolled = enrollCustomer(first, { mobile: "09000000001", name: "Zed" });
  saveState(enrolled.state);
  assert.ok(loadState().customers.some((c) => c.mobile_number === "09000000001"), "survives reload");
  mem.set(STORAGE_KEY, "{not json");
  assert.ok(loadState().customers.length > 0, "corrupt data falls back to seed");
  saveState(enrolled.state);
  assert.ok(!resetState().customers.some((c) => c.mobile_number === "09000000001"), "reset removes enrolled customers");
});
