import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";

// status: loading | signed_out | not_staff | staff
// Being signed in is not enough: the database must also confirm the user is on
// the staff list (staff_check). Every staff action is re-checked there again.
export function useStaffSession() {
  const [session, setSession] = useState({ status: "loading", email: "" });

  const verify = useCallback(async (email) => {
    const res = await api.staffCheck();
    if (res.ok && res.is_staff) return { status: "staff", email };
    if (res.ok) return { status: "not_staff", email };
    if (res.code === "forbidden") return { status: "signed_out", email: "" };
    return { status: "signed_out", email: "", problem: res.message };
  }, []);

  useEffect(() => {
    let alive = true;
    const existing = api.getSession();
    if (!existing) {
      setSession({ status: "signed_out", email: "" });
      return undefined;
    }
    verify(existing.email).then((s) => alive && setSession(s));
    return () => {
      alive = false;
    };
  }, [verify]);

  const signIn = useCallback(
    async (email, password) => {
      const res = await api.signIn(email, password);
      if (!res.ok) return res;
      const next = await verify(res.email);
      setSession(next);
      return { ok: true };
    },
    [verify]
  );

  const signOut = useCallback(async () => {
    await api.signOut();
    setSession({ status: "signed_out", email: "" });
  }, []);

  return { ...session, signIn, signOut };
}
