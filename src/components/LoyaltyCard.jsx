import { useState } from "react";
import { STAMPS_PER_CARD, maskMobile } from "../logic/loyalty.js";
import { DemoTag } from "./Decor";
import EnrollForm from "./EnrollForm";
import PurchaseHistory from "./PurchaseHistory";
import RewardStatus from "./RewardStatus";
import StampProgress from "./StampProgress";

export default function LoyaltyCard({ summary, onLookup, onEnroll }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingMobile, setPendingMobile] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setNotice("");
    setBusy(true);
    const result = await onLookup(input);
    setBusy(false);
    if (result.ok) {
      setError("");
      setPendingMobile(null);
    } else if (result.code === "not_found") {
      setError("");
      setPendingMobile(result.mobile);
    } else {
      setError(result.message);
      setPendingMobile(null);
    }
  };

  const enroll = async (data) => {
    const result = await onEnroll(data);
    if (result.ok) {
      setPendingMobile(null);
      setNotice(`Welcome${result.customer.name ? `, ${result.customer.name}` : ""}! Your card is ready.`);
    }
    return result;
  };

  const s = summary;
  return (
    <div className="paper paper--ticket">
      <p className="eyebrow">A LITTLE SOMETHING FOR YOUR USUAL</p>
      <h2>Your loyalty card</h2>
      <form className="row" onSubmit={submit} noValidate>
        <div className="grow field">
          <label className="sr-only" htmlFor="mobile">Mobile number</label>
          <input
            id="mobile"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="09123456789"
            value={input}
            aria-invalid={!!error}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <button className="btn" type="submit" disabled={busy || !input.trim()}>{busy ? "Loading…" : "Load card"}</button>
      </form>
      {error && <p className="msg msg--error" role="alert">{error}</p>}
      {notice && <p className="msg msg--ok" role="status">{notice}</p>}

      {pendingMobile ? (
        <EnrollForm key={pendingMobile} mobile={pendingMobile} onEnroll={enroll} onCancel={() => setPendingMobile(null)} />
      ) : !s ? (
        <p className="muted">No customer selected yet.</p>
      ) : (
        <div className="card-body">
          <p className="muted small">
            Card for {s.customer.name ? `${s.customer.name} · ` : ""}{maskMobile(s.customer.mobile_number)}{" "}
            {s.customer.is_demo && <DemoTag />}
          </p>
          <div className="card-head">
            <p><span className="count">{s.status.currentStamps}</span> <span className="of">/ {STAMPS_PER_CARD} cups</span></p>
            <p className="usual">Usual: {s.usual ? s.usual.name : "none yet"}</p>
          </div>
          <StampProgress key={s.customer.id} count={s.status.currentStamps} />
          <p className="remaining">
            {s.status.remaining === 0
              ? "Card complete. Your free drink is ready."
              : `${s.status.remaining} more ${s.status.remaining === 1 ? "cup" : "cups"} until your next one is free.`}
          </p>
          <RewardStatus summary={s} />
          <PurchaseHistory purchases={s.purchases} />
        </div>
      )}
    </div>
  );
}
