// DEMO SEED DATA. Written to this browser's localStorage the first time the
// app opens. In production this lives in the shared database.
import { REWARD_STATUS } from "../logic/loyalty.js";
import { drinkById } from "../logic/loyalty.js";
import { emptyState } from "../logic/customerService.js";

const DAY = 24 * 60 * 60 * 1000;

const rep = (id, n) => Array(n).fill(id);
const MAC = "iced-caramel-macchiato";

// drinks are listed oldest -> newest
const SEED = [
  { mobile: "09123456789", name: "Ana", drinks: [MAC] },
  { mobile: "09171234567", name: "Ben", drinks: [...rep("spanish-latte", 3), ...rep("don-darko", 2), "hot-caramel"] },
  { mobile: "09987654321", name: "Carla", drinks: [...rep("don-barako", 6), ...rep("hot-darko", 2), "black-forest"] },
  { mobile: "09556667777", name: "", drinks: [] },
  { mobile: "09445556666", name: "Dino", drinks: [...rep(MAC, 5), ...rep("spanish-latte", 3), ...rep("don-pistachio", 2)], rewards: [REWARD_STATUS.EARNED] },
  { mobile: "09334445555", name: "Elle", drinks: [...rep(MAC, 5), ...rep("spanish-latte", 2), "don-pistachio"] },
  { mobile: "09223334444", name: "Faye", drinks: [...rep("oreo-coffee", 6), ...rep("donya-berry", 4), "oreo-coffee", "matcha-berry"], rewards: [REWARD_STATUS.REDEEMED] },
];

export const DEMO_NUMBERS = SEED.map((s) => s.mobile);

export function buildSeedState(now = Date.now()) {
  const state = emptyState();
  let n = 0;
  SEED.forEach((s, i) => {
    const id = `cus_demo${i + 1}`;
    state.customers.push({ id, name: s.name, mobile_number: s.mobile, created_at: new Date(now - (s.drinks.length + 3) * 2 * DAY).toISOString() });
    s.drinks.forEach((drinkId, j) => {
      const bought = now - (s.drinks.length - j) * 2 * DAY;
      n += 1;
      state.purchases.push({
        id: `pur_demo${n}`,
        customer_id: id,
        drink_id: drinkId,
        drink_name: drinkById(drinkId).name,
        purchase_code: `D${String(n).padStart(4, "0")}`,
        purchased_at: new Date(bought).toISOString(),
        redeemed_at: new Date(bought + 5 * 60 * 1000).toISOString(),
      });
    });
    (s.rewards || []).forEach((status, k) => {
      const earned = now - (s.drinks.length - (k + 1) * 10 + 1) * 2 * DAY;
      state.rewards.push({
        id: `rew_demo${id}_${k + 1}`,
        customer_id: id,
        card_number: k + 1,
        reward_status: status,
        earned_at: new Date(earned).toISOString(),
        redeemed_at: status === REWARD_STATUS.REDEEMED ? new Date(earned + DAY).toISOString() : null,
      });
    });
  });
  return state;
}
