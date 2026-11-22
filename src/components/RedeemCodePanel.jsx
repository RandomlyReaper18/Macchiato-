import { useState } from "react";

export default function RedeemCodePanel({ onRedeem }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const r = await onRedeem(code);
    setBusy(false);
    setResult(r);
    if (r.ok) setCode("");
  };

  return (
    <div className="paper paper--ticket">
      <h2>Redeem a purchase code</h2>
      <p>Enter the one-time code from staff. Each valid code adds +1 cup to your card.</p>
      <form className="row" onSubmit={submit}>
        <div className="grow field">
          <label className="sr-only" htmlFor="code">Purchase code</label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Enter purchase code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <button className="btn" type="submit" disabled={busy || !code.trim()}>{busy ? "Adding…" : "Add +1 cup"}</button>
      </form>
      {result && (
        <p className={result.ok ? "msg msg--ok" : "msg msg--error"} role="status">{result.message}</p>
      )}
    </div>
  );
}
