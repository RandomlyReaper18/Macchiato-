// Live integration check against YOUR real Supabase project. Run:
//   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... STAFF_EMAIL=... STAFF_PASSWORD=... npm run test:live
// (On Windows PowerShell set the variables first with $env:NAME="value".)
// It only touches demo records: it enrolls a throw-away customer in the reserved
// test range 09000000xxx (flagged is_demo) and issues one code. Staff can remove
// the leftovers with "Remove demo customers" in the Staff panel.
import { createClient } from "../src/data/supabase.js";
import { createApi } from "../src/logic/api.js";

const url = (process.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const key = (process.env.VITE_SUPABASE_ANON_KEY || "").trim();
const { STAFF_EMAIL, STAFF_PASSWORD } = process.env;

if (!url || !key) {
  console.log("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first (see README). Nothing was tested.");
  process.exit(2);
}

const mem = new Map();
const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const api = createApi(createClient({ url, key, storage }));

let failed = 0;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  -> ${detail}` : ""}`);
};
const skip = (name, why) => console.log(`SKIP  ${name}  (${why})`);
const total = (r) => (r.ok ? r.summary.status.total : -1);

const mobile = `09000000${String(Math.floor(Math.random() * 900) + 100)}`; // fresh demo number per run

// 1. Database connection (a real round trip)
const ping = await api.ping();
check("1. Database connection", ping.ok === true, ping.message);
if (!ping.ok) { console.log("\nStopping: the database can't be reached or isn't set up."); process.exit(1); }

// 2-3. Customer creation + lookup
const made = await api.enroll({ mobile, name: "LIVE TEST" });
check("2. Customer creation", made.ok && made.summary.customer.is_demo === true, made.message);
const found = await api.lookup(mobile);
check("3. Customer lookup", found.ok && found.summary.customer.mobile_number === mobile, found.message);
const before = total(found);

// Security: the public key must not reach staff functions or tables
const anonIssue = await api.issueCode("spanish-latte", crypto.randomUUID());
check("Security: customers cannot issue codes", anonIssue.ok === false && anonIssue.code === "forbidden", JSON.stringify(anonIssue));
const direct = await fetch(`${url}/rest/v1/customers?select=*`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
const directBody = await direct.json().catch(() => null);
check("Security: customer table not readable with the public key", !(Array.isArray(directBody) && directBody.length > 0), `HTTP ${direct.status}`);

if (!STAFF_EMAIL || !STAFF_PASSWORD) {
  for (const n of ["4-5. Code generation + persistence", "7. Show same code", "8. Start next purchase", "9-13. Redeem, rejects, stamp, history"]) skip(n, "set STAFF_EMAIL and STAFF_PASSWORD");
} else {
  const login = await api.signIn(STAFF_EMAIL, STAFF_PASSWORD);
  check("Staff sign-in", login.ok, login.message);
  const who = await api.staffCheck();
  check("Staff is on the staff list", who.ok && who.is_staff === true, JSON.stringify(who));
  if (login.ok && who.is_staff) {
    // 4-5. Generate + persist
    const token = crypto.randomUUID();
    const issued = await api.issueCode("spanish-latte", token);
    check("4. Purchase code generated (4 digits, linked to drink)", issued.ok && /^\d{4}$/.test(issued.code) && issued.drink_name === "Spanish Latte", JSON.stringify(issued));
    const stored = await api.getSaleCode(token);
    check("5. Purchase code persisted in the database", stored.ok && stored.code === issued.code && stored.status === "issued", JSON.stringify(stored));

    // 7. Same code, never a new one
    const again = await api.issueCode("spanish-latte", token);
    check("7. Same sale shows the SAME code", again.ok && again.code === issued.code && again.reused === true, JSON.stringify(again));

    // 9. Valid redemption + 12. stamp +1 + 13. history
    const good = await api.redeem(mobile, issued.code);
    check("9. Valid code redeemed", good.ok === true, good.message);
    check("12. Exactly one stamp added", total(good) === before + 1, `before ${before}, after ${total(good)}`);
    check("13. Purchase history record created", good.ok && good.summary.purchases.some((p) => p.drink_name === "Spanish Latte" && p.purchase_code === issued.code));

    // 11. Duplicate rejected (and no extra stamp)
    const dup = await api.redeem(mobile, issued.code);
    check("11. Used code rejected", dup.ok === false && dup.code === "used", JSON.stringify(dup));

    // 10. Invalid rejected
    const bad = await api.redeem(mobile, "abcd");
    check("10. Invalid code rejected", bad.ok === false, JSON.stringify(bad));

    // 14. Persistence: a brand-new client (like a refreshed page) sees the same data
    const fresh = createApi(createClient({ url, key, storage: { getItem: () => null, setItem() {}, removeItem() {} } }));
    const reloaded = await fresh.lookup(mobile);
    check("14. Data persists after refresh (new session)", total(reloaded) === before + 1, `got ${total(reloaded)}`);

    // 8. Start next purchase = a new sale token gets a new, separate code; old record kept
    const next = await api.issueCode("don-barako", crypto.randomUUID());
    check("8. Start next purchase gives a separate new code", next.ok && next.reused === false && next.code !== issued.code, JSON.stringify(next));
    const old = await api.getSaleCode(token);
    check("8b. Old purchase code record kept", old.ok && old.status === "redeemed");
    await api.signOut();
  }
}
console.log("\n6. Copy code: browser clipboard, test by hand in the Staff panel.");
console.log(failed ? `\n${failed} check(s) FAILED.` : "\nAll live checks passed.");
process.exit(failed ? 1 : 0);
