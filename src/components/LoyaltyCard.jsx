import { useState } from "react";
import { DEMO_NUMBERS } from "../data/customers.js";
import { STORAGE_NOTICE } from "../data/store.js";
import { STAMPS_PER_CARD, maskMobile } from "../logic/loyalty.js";
import { DemoTag } from "./Decor";
import EnrollForm from "./EnrollForm";
import PurchaseHistory from "./PurchaseHistory";
import RewardStatus from "./RewardStatus";
import StampProgress from "./StampProgress";

export default function LoyaltyCard({ summary, persisted, onLookup, onEnroll }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingMobile, setPendingMobile] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    setNotice("");
    const result = onLookup(input);
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

  const enroll = (data) => {
    const result = onEnroll(data);
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
        <button className="btn" type="submit" disabled={!input.trim()}>Load card</button>
      </form>
      {error && <p className="msg msg--error" role="alert">{error}</p>}
      {notice && <p className="msg msg--ok" role="status">{notice}</p>}

      {pendingMobile ? (
        <EnrollForm key={pendingMobile} mobile={pendingMobile} onEnroll={enroll} onCancel={() => setPendingMobile(null)} />
      ) : !s ? (
        <>
          <p className="muted">No customer selected yet.</p>
          <div className="chips">
            <DemoTag />
            {DEMO_NUMBERS.map((n) => (
              <button key={n} type="button" className="chip" onClick={() => setInput(n)}>{n}</button>
            ))}
          </div>
        </>
      ) : (
        <div className="card-body">
          <p className="muted small">
            Card for {s.customer.name ? `${s.customer.name} · ` : ""}{maskMobile(s.customer.mobile_number)}
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

      <p className="muted small storage-note">{STORAGE_NOTICE}</p>
      {!persisted && (
        <p className="msg msg--error" role="alert">
          This browser is blocking storage, so changes will be lost when you reload.
        </p>
      )}
    </div>
  );
}
