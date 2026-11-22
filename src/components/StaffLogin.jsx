import { useState } from "react";

// Staff sign-in (Supabase Auth). Staff accounts are created by the owner in the
// Supabase dashboard; there is no public sign-up.
export default function StaffLogin({ onSignIn, problem }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await onSignIn(email, password);
    setBusy(false);
    if (!res.ok) setError(res.message);
    else setPassword("");
  };

  return (
    <div className="paper paper--ticket">
      <h2>Staff sign in</h2>
      <p>Only staff can issue purchase codes. Sign in with the account the owner created for you.</p>
      {problem && <p className="msg msg--error" role="alert">{problem}</p>}
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="staff-email">Email</label>
          <input id="staff-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field" style={{ marginTop: ".6rem" }}>
          <label htmlFor="staff-password">Password</label>
          <input id="staff-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="msg msg--error" role="alert">{error}</p>}
        <div className="row" style={{ marginTop: ".9rem" }}>
          <button className="btn" type="submit" disabled={busy || !email.trim() || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
