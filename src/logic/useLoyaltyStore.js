import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEY, loadState, resetState, saveState } from "../data/store.js";
import { enrollCustomer, giveReward, lookupCustomer, recordRedeemedPurchase } from "./customerService.js";

// The only place React state meets storage. Components never write records
// directly; they call these actions, which run the rules in customerService.
export function useLoyaltyStore() {
  const [state, setState] = useState(loadState);
  const [persisted, setPersisted] = useState(true);
  const latest = useRef(state);

  const commit = useCallback((next) => {
    latest.current = next;
    setState(next);
    setPersisted(saveState(next));
  }, []);

  const run = useCallback(
    (fn) => {
      const result = fn(latest.current);
      if (result.ok && result.state) commit(result.state);
      return result;
    },
    [commit]
  );

  // Keep several tabs of this browser in step.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        const next = loadState();
        latest.current = next;
        setState(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return {
    state,
    persisted,
    lookup: (raw) => lookupCustomer(latest.current, raw),
    enroll: (data) => run((s) => enrollCustomer(s, data)),
    recordPurchase: (data) => run((s) => recordRedeemedPurchase(s, data)),
    giveRewardTo: (mobile) => {
      const found = lookupCustomer(latest.current, mobile);
      if (!found.ok) return found;
      return run((s) => giveReward(s, found.customer.id));
    },
    reset: () => commit(resetState()),
  };
}
