import { useState } from "react";
import { MENU } from "../data/menu";
import { drinkById } from "../logic/loyalty";
import { DemoTag } from "./Decor";

export default function StaffCodePanel({ onIssue, onGiveReward }) {
  const [open, setOpen] = useState(true);
  const [drinkId, setDrinkId] = useState(MENU[0].id);
  const [current, setCurrent] = useState(null);
  const [reused, setReused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rewardMobile, setRewardMobile] = useState("");
  const [rewardResult, setRewardResult] = useState(null);

  const giveReward = (e) => {
    e.preventDefault();
    const r = onGiveReward(rewardMobile);
    setRewardResult(r);
    if (r.ok) setRewardMobile("");
  };

  const issue = () => {
    if (current) return setReused(true);
    setCurrent(onIssue(drinkId));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current.code);
    } catch {
      const t = document.createElement("textarea");
      t.value = current.code;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const next = () => {
    setCurrent(null);
    setReused(false);
    setCopied(false);
  };

  return (
    <div className="paper paper--ticket">
      <div className="panel-head">
        <h2>Staff: issue a purchase code <DemoTag /></h2>
        <button
          className="toggle"
          type="button"
          aria-expanded={open}
          aria-controls="staff-body"
          aria-label={open ? "Collapse staff panel" : "Expand staff panel"}
          onClick={() => setOpen(!open)}
        >
          {open ? "−" : "+"}
        </button>
      </div>

      {open && (
        <div id="staff-body">
          <p>
            After a customer pays, select the drink and issue one code. Clicking again shows
            the same code. For another sale, choose “Start next purchase” first.
          </p>
          <div className="row">
            <div className="grow field">
              <label className="sr-only" htmlFor="drink">Drink</label>
              <select id="drink" value={drinkId} disabled={!!current} onChange={(e) => setDrinkId(e.target.value)}>
                {MENU.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <button className="btn" type="button" onClick={issue}>
              {current ? "Show same code" : "Issue code"}
            </button>
          </div>

          {current && (
            <div className="code-block">
              <p>Give this one-time code to the customer:</p>
              <p className="code" aria-label={`Code ${current.code.split("").join(" ")}`}>{current.code}</p>
              <div className="row">
                <button className="btn btn--dark" type="button" onClick={copy}>
                  {copied ? "Copied!" : "Copy code"}
                </button>
                <button className="btn btn--ghost" type="button" onClick={next}>Start next purchase</button>
              </div>
              {reused && (
                <p className="msg">
                  This code is already issued for {drinkById(current.drinkId).name}. Reuse it for this purchase.
                </p>
              )}
              <p className="muted small">Expires in 15 minutes. Works once.</p>
            </div>
          )}
          <div className="subsection">
            <h3>Free drink rewards</h3>
            <p>When a customer shows a completed card, enter their number and mark the free drink as given.</p>
            <form className="row" onSubmit={giveReward} noValidate>
              <div className="grow field">
                <label className="sr-only" htmlFor="reward-mobile">Customer mobile number</label>
                <input
                  id="reward-mobile"
                  type="tel"
                  inputMode="numeric"
                  placeholder="Customer mobile number"
                  value={rewardMobile}
                  onChange={(e) => setRewardMobile(e.target.value)}
                />
              </div>
              <button className="btn btn--dark" type="submit" disabled={!rewardMobile.trim()}>Mark free drink as given</button>
            </form>
            {rewardResult && (
              <p className={rewardResult.ok ? "msg msg--ok" : "msg msg--error"} role="status">{rewardResult.message}</p>
            )}
          </div>
          <p className="muted small">
            Demo only: anyone can open this panel. In production, staff sign in and codes are created on the server.
          </p>
        </div>
      )}
    </div>
  );
}
