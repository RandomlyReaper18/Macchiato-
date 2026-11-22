// Persistence adapter. TEMPORARY: uses the browser's localStorage, so data is
// private to THIS browser on THIS device. It is NOT a shared database: staff
// and customers on different devices will not see each other's records.
// Phase 3+ replaces this file with calls to a real shared database.
import { buildSeedState } from "./customers.js";

export const STORAGE_KEY = "usual-cafe:v1";
export const STORAGE_NOTICE = "Saved in this browser only (localStorage). Not a shared customer database.";

const looksValid = (s) =>
  s && s.version === 1 && Array.isArray(s.customers) && Array.isArray(s.purchases) && Array.isArray(s.rewards);

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false; // storage blocked or full: the app keeps working in memory
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (looksValid(parsed)) return parsed;
    }
  } catch {
    /* fall through to a fresh seed */
  }
  const seed = buildSeedState();
  saveState(seed);
  return seed;
}

export function resetState() {
  const seed = buildSeedState();
  saveState(seed);
  return seed;
}
