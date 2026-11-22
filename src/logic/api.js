// The only module the screens use to reach the database. Each function calls one
// database function (see src/supabase/schema.sql). The database makes every real
// decision (code valid? stamp added? staff allowed?); this file only forwards
// the request and shapes the answer for the screens.
import { client as defaultClient } from "../data/supabase.js";
import { customerSummary } from "./customerService.js";
import { isValidMobile, normalizeMobile } from "./loyalty.js";

// Server card data -> the same summary object the Phase 2 screens already use.
export function summaryFromCard(card) {
  const state = { version: 1, customers: [card.customer], purchases: card.purchases || [], rewards: card.rewards || [] };
  return customerSummary(state, card.customer);
}

const withSummary = (res) => (res.ok && res.customer ? { ...res, summary: summaryFromCard(res) } : res);

export function createApi(client = defaultClient) {
  const staff = { asStaff: true };
  return {
    configured: client.configured,
    getSession: client.getSession,
    signIn: (email, password) => client.signIn(String(email || "").trim(), String(password || "")),
    signOut: () => client.signOut(),

    // Real round trip to the database (used by the connection indicator).
    ping: () => client.rpc("ping"),

    // ---- customer ----
    async lookup(raw) {
      const mobile = normalizeMobile(raw);
      if (!mobile) return { ok: false, code: "empty", message: "Enter your mobile number." };
      if (!isValidMobile(mobile)) {
        return { ok: false, code: "invalid", message: "Enter an 11-digit mobile number that starts with 09." };
      }
      return withSummary(await client.rpc("get_card", { p_mobile: mobile }));
    },
    async enroll({ mobile, name }) {
      return withSummary(await client.rpc("enroll_customer", { p_mobile: mobile, p_name: name || "" }));
    },
    async redeem(mobile, code) {
      const clean = String(code || "").replace(/\s/g, "");
      if (!mobile) return { ok: false, code: "no_customer", message: "Load your loyalty card first." };
      if (!clean) return { ok: false, code: "empty", message: "Enter the code from staff." };
      return withSummary(await client.rpc("redeem_code", { p_mobile: mobile, p_code: clean }));
    },

    // ---- staff (the database re-checks the staff login on every call) ----
    staffCheck: () => client.rpc("staff_check", {}, staff),
    issueCode: (drinkId, saleToken) => client.rpc("issue_code", { p_drink_id: drinkId, p_sale_token: saleToken }, staff),
    getSaleCode: (saleToken) => client.rpc("get_sale_code", { p_sale_token: saleToken }, staff),
    giveReward: (mobile) => client.rpc("give_reward", { p_mobile: normalizeMobile(mobile) }, staff),
    createDemoData: () => client.rpc("create_demo_data", {}, staff),
    removeDemoData: () => client.rpc("remove_demo_data", {}, staff),
  };
}

export const api = createApi();
