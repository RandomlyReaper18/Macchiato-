import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";

// Connection indicator state. "connected" is shown ONLY after a real request to
// the database (the ping function) succeeds; having the env variables is not enough.
const LABELS = {
  connecting: "Checking database…",
  connected: "Database connected",
  disconnected: "Database unreachable",
  error: "Database error",
};

export function useDbStatus(intervalMs = 30000) {
  const [status, setStatus] = useState({ state: "connecting", label: LABELS.connecting, detail: "" });
  const alive = useRef(true);

  const check = useCallback(async () => {
    setStatus((s) => (s.state === "connected" ? s : { state: "connecting", label: LABELS.connecting, detail: "" }));
    const res = await api.ping();
    if (!alive.current) return;
    if (res.ok) setStatus({ state: "connected", label: LABELS.connected, detail: "" });
    else if (res.code === "network") setStatus({ state: "disconnected", label: LABELS.disconnected, detail: res.message });
    else setStatus({ state: "error", label: LABELS.error, detail: res.message });
  }, []);

  useEffect(() => {
    alive.current = true;
    check();
    const timer = setInterval(check, intervalMs);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [check, intervalMs]);

  return { ...status, recheck: check };
}
