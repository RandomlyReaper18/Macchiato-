import test from "node:test";
import assert from "node:assert/strict";
import { createClient, isConfigured } from "../src/data/supabase.js";
import { createApi, summaryFromCard } from "../src/logic/api.js";

const URL_ = "https://demo.supabase.co";
const KEY = "anon-key-anon-key-anon-key-123";
const memStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

// Records every request and answers with whatever `handler` returns.
function mock(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const call = { url, method: init?.method, headers: init?.headers || {}, body: init?.body ? JSON.parse(init.body) : null };
    calls.push(call);
    return handler(call);
  };
  return { calls, fetchImpl };
}
const make = (handler, extra = {}) => {
  const m = mock(handler);
  const client = createClient({ url: URL_, key: KEY, fetchImpl: m.fetchImpl, storage: memStore(), ...extra });
  return { ...m, client, api: createApi(client) };
};

test("config: needs a real https URL and a key", () => {
  assert.equal(isConfigured({ url: "", key: "" }), false);
  assert.equal(isConfigured({ url: URL_, key: "short" }), false);
  assert.equal(isConfigured({ url: URL_, key: KEY }), true);
});

test("not configured: nothing is faked, every call says so", async () => {
  const api = createApi(createClient({ url: "", key: "", fetchImpl: async () => { throw new Error("must not be called"); }, storage: memStore() }));
  assert.equal((await api.ping()).code, "not_configured");
  assert.equal((await api.lookup("09123456789")).code, "not_configured");
});

test("customer calls use the public key and the right function", async () => {
  const t = make(() => reply(200, { ok: true, time: "now" }));
  const r = await t.api.ping();
  assert.equal(r.ok, true);
  assert.equal(t.calls[0].url, `${URL_}/rest/v1/rpc/ping`);
  assert.equal(t.calls[0].headers.Authorization, `Bearer ${KEY}`);
  assert.equal(t.calls[0].headers.apikey, KEY);
});

test("lookup validates on the client first, then asks the database", async () => {
  const t = make(() => reply(200, { ok: false, code: "not_found", mobile: "09123456789", message: "No card found for that number yet." }));
  assert.equal((await t.api.lookup("")).code, "empty");
  assert.equal((await t.api.lookup("12345")).code, "invalid");
  assert.equal(t.calls.length, 0, "invalid input never reaches the database");
  const r = await t.api.lookup("+63 912 345 6789");
  assert.equal(r.code, "not_found");
  assert.deepEqual(t.calls[0].body, { p_mobile: "09123456789" }, "number is normalized");
});

test("card data from the database becomes the loyalty card summary", async () => {
  const card = {
    ok: true,
    customer: { id: "c1", name: "Ana", mobile_number: "09123456789", created_at: "2026-01-01T00:00:00Z", is_demo: false },
    purchases: [
      { id: "p2", customer_id: "c1", drink_id: "spanish-latte", drink_name: "Spanish Latte", purchase_code: "1111", purchased_at: "2026-02-02T00:00:00Z", redeemed_at: "2026-02-02T00:00:00Z" },
      { id: "p1", customer_id: "c1", drink_id: "spanish-latte", drink_name: "Spanish Latte", purchase_code: "2222", purchased_at: "2026-02-01T00:00:00Z", redeemed_at: "2026-02-01T00:00:00Z" },
    ],
    rewards: [],
  };
  const s = summaryFromCard(card);
  assert.equal(s.status.currentStamps, 2);
  assert.equal(s.status.remaining, 8);
  assert.equal(s.usual.name, "Spanish Latte");
  const t = make(() => reply(200, card));
  const r = await t.api.lookup("09123456789");
  assert.equal(r.summary.status.total, 2);
});

test("redeem: sends only the number and the code, never a stamp count", async () => {
  const t = make(() => reply(200, { ok: false, code: "used", message: "That code has already been used." }));
  assert.equal((await t.api.redeem(null, "1234")).code, "no_customer");
  assert.equal((await t.api.redeem("09123456789", "  ")).code, "empty");
  const r = await t.api.redeem("09123456789", "12 34");
  assert.equal(r.code, "used");
  assert.deepEqual(t.calls[0].body, { p_mobile: "09123456789", p_code: "1234" });
});

test("server and network problems become readable results", async () => {
  assert.equal((await make(() => reply(404, { code: "PGRST202" })).api.ping()).code, "not_set_up");
  assert.equal((await make(() => reply(500, { message: "boom" })).api.ping()).code, "error");
  const down = make(() => { throw new TypeError("fetch failed"); });
  assert.equal((await down.api.ping()).code, "network");
});

test("staff calls are refused locally when nobody is signed in", async () => {
  const t = make(() => reply(200, {}));
  const r = await t.api.issueCode("spanish-latte", "tok");
  assert.equal(r.code, "forbidden");
  assert.equal(t.calls.length, 0);
});

test("staff sign-in: token is used for staff calls only; sign-out clears it", async () => {
  const t = make((c) => {
    if (c.url.includes("grant_type=password")) {
      return c.body.password === "right"
        ? reply(200, { access_token: "STAFF.JWT", refresh_token: "r1", expires_in: 3600, user: { email: "s@x.com" } })
        : reply(400, { error: "invalid_grant" });
    }
    if (c.url.endsWith("/logout")) return reply(204, {});
    return reply(200, { ok: true, code: "4821", status: "issued" });
  });
  assert.equal((await t.api.signIn("s@x.com", "wrong")).code, "bad_login");
  assert.equal(t.api.getSession(), null);
  assert.equal((await t.api.signIn(" s@x.com ", "right")).ok, true);
  assert.equal(t.api.getSession().email, "s@x.com");

  await t.api.issueCode("spanish-latte", "11111111-1111-4111-8111-111111111111");
  const staffCall = t.calls.at(-1);
  assert.equal(staffCall.headers.Authorization, "Bearer STAFF.JWT");
  assert.deepEqual(staffCall.body, { p_drink_id: "spanish-latte", p_sale_token: "11111111-1111-4111-8111-111111111111" });

  await t.api.lookup("09123456789"); // customer call from a staff device
  assert.equal(t.calls.at(-1).headers.Authorization, `Bearer ${KEY}`, "customer calls never carry the staff token");

  await t.api.signOut();
  assert.equal(t.api.getSession(), null);
  assert.equal((await t.api.issueCode("spanish-latte", "tok")).code, "forbidden");
});

test("staff session is refreshed before it expires, and dropped if refresh is rejected", async () => {
  let clock = 1_000_000;
  let refreshOk = true;
  const t = make((c) => {
    if (c.url.includes("grant_type=password")) return reply(200, { access_token: "A1", refresh_token: "R1", expires_in: 3600, user: { email: "s@x.com" } });
    if (c.url.includes("grant_type=refresh_token")) {
      return refreshOk ? reply(200, { access_token: "A2", refresh_token: "R2", expires_in: 3600 }) : reply(400, {});
    }
    return reply(200, { ok: true });
  }, { now: () => clock });
  await t.api.signIn("s@x.com", "pw");
  clock += 3_580_000; // inside the 60 s refresh margin
  await t.api.giveReward("09123456789");
  assert.equal(t.calls.at(-1).headers.Authorization, "Bearer A2");
  refreshOk = false;
  clock += 3_580_000;
  assert.equal((await t.api.giveReward("09123456789")).code, "forbidden");
  assert.equal(t.api.getSession(), null, "rejected refresh signs staff out");
});

test("database 'not staff' error maps to forbidden", async () => {
  const t = make((c) => (c.url.includes("grant_type=password")
    ? reply(200, { access_token: "A", refresh_token: "R", expires_in: 3600, user: { email: "s@x.com" } })
    : reply(403, { code: "42501", message: "Staff access only" })));
  await t.api.signIn("s@x.com", "pw");
  assert.equal((await t.api.issueCode("spanish-latte", "tok")).code, "forbidden");
});
