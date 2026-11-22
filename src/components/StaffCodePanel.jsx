import { useEffect, useState } from "react";
import { MENU } from "../data/menu";

const SALE_KEY = "doncafe:sale";
const DEMO_LIST = [
  ["09000000001", "Demo Empty Card", "0 cups"],
  ["09000000002", "Demo Three Cups", "3 cups"],
  ["09000000003", "Demo Nine Cups", "9 cups, one more completes the card"],
];

// The sale in progress is remembered for this tab only, so a page reload does not
// lose the code. Only the sale's random token is kept; the code itself stays in the database.
const readSale = () => {
  try { return sessionStorage.getItem(SALE_KEY); } catch { return null; }
};
const saveSale = (token) => {
  try { token ? sessionStorage.setItem(SALE_KEY, token) : sessionStorage.removeItem(SALE_KEY); } catch { /* ignore */ }
};
const newToken = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const timeOf = (iso) => new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

export default function StaffCodePanel({ api, email, onSignOut }) {
  const [open, setOpen] = useState(true);
  const [drinkId, setDrinkId] = useState(MENU[0].id);
  const [sale, setSale] = useState(null); // token of the sale in progress
  const [current, setCurrent] = useState(null); // code details from the database
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null); // { ok, text }
  const [copied, setCopied] = useState(false);
  const [rewardMobile, setRewardMobile] = useState("");
  const [rewardResult, setRewardResult] = useState(null);
  const [demoResult, setDemoResult] = useState(null);

  const fail = (res) => {
    if (res.code === "forbidden") {
      setNote({ ok: false, text: "Your staff session ended. Please sign in again." });
      onSignOut();
    } else {
      setNote({ ok: false, text: res.message || "Something went wrong." });
    }
  };

  // After a reload, bring back the sale in progress (read-only, never creates a code).
  useEffect(() => {
    const token = readSale();
    if (!token) return undefined;
    let alive = true;
    api.getSaleCode(token).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setSale(token);
        setCurrent(res);
        setDrinkId(res.drink_id);
      } else {
        saveSale(null);
      }
    });
    return () => { alive = false; };
  }, [api]);

  const issue = async () => {
    setBusy(true);
    setNote(null);
    const token = newToken();
    const res = await api.issueCode(drinkId, token);
    setBusy(false);
    if (!res.ok) return fail(res);
    setSale(token);
    saveSale(token);
    setCurrent(res);
    setNote({ ok: true, text: "Code issued and saved." });
  };

  const showSame = async () => {
    setBusy(true);
    setNote(null);
    const res = await api.getSaleCode(sale);
    setBusy(false);
    if (!res.ok) return fail(res);
    setCurrent(res);
    setNote({ ok: true, text: "This is the same code, not a new one." });
  };

  const copy = async () => {
    let done = false;
    try {
      await navigator.clipboard.writeText(current.code);
      done = true;
    } catch {
      const t = document.createElement("textarea");
      t.value = current.code;
      t.setAttribute("readonly", "");
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      try { done = document.execCommand("copy"); } catch { done = false; }
      t.remove();
    }
    setCopied(done);
    setNote(done ? { ok: true, text: "Code copied to the clipboard." } : { ok: false, text: "Couldn't copy. Select the code and copy it by hand." });
    if (done) setTimeout(() => setCopied(false), 2000);
  };

  // Ends this sale on screen. The saved code and all purchase records stay in the database.
  const next = () => {
    saveSale(null);
    setSale(null);
    setCurrent(null);
    setCopied(false);
    setNote(null);
  };

  const giveReward = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await api.giveReward(rewardMobile);
    setBusy(false);
    if (res.ok) {
      setRewardResult({ ok: true, message: "Free drink marked as given." });
      setRewardMobile("");
    } else if (res.code === "forbidden") {
      fail(res);
    } else {
      setRewardResult({ ok: false, message: res.message });
    }
  };

  const demo = async (create) => {
    if (!create && !window.confirm("Remove the demo customers and their demo purchases? Real customers are not touched.")) return;
    setBusy(true);
    const res = await (create ? api.createDemoData() : api.removeDemoData());
    setBusy(false);
    if (res.ok) setDemoResult({ ok: true, created: create });
    else if (res.code === "forbidden") fail(res);
    else setDemoResult({ ok: false, message: res.message });
  };

  const expired = current && (current.status === "expired" || (current.status === "issued" && Date.parse(current.expires_at) <= Date.now()));
  const redeemed = current && current.status === "redeemed";

  return (
    <div className="paper paper--ticket">
      <div className="panel-head">
        <h2>Staff: issue a purchase code</h2>
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
          <p className="muted small">
            Signed in as {email}{" "}
            <button className="link-btn" type="button" onClick={onSignOut}>Sign out</button>
          </p>
          <p>
            After a customer pays, select the drink and issue one code. “Show same code” brings back
            the same code for this sale. For another sale, choose “Start next purchase” first.
          </p>
          <div className="row">
            <div className="grow field">
              <label className="sr-only" htmlFor="drink">Drink</label>
              <select id="drink" value={drinkId} disabled={!!sale || busy} onChange={(e) => setDrinkId(e.target.value)}>
                {MENU.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <button className="btn" type="button" disabled={busy} onClick={sale ? showSame : issue}>
              {sale ? "Show same code" : "Issue code"}
            </button>
          </div>
          {note && <p className={note.ok ? "msg msg--ok" : "msg msg--error"} role="status">{note.text}</p>}

          {current && (
            <div className="code-block">
              <p>Give this one-time code to the customer ({current.drink_name}):</p>
              <p className="code" aria-label={`Code ${current.code.split("").join(" ")}`}>{current.code}</p>
              <div className="row">
                <button className="btn btn--dark" type="button" onClick={copy}>
                  {copied ? "Copied!" : "Copy code"}
                </button>
                <button className="btn btn--ghost" type="button" onClick={next}>Start next purchase</button>
              </div>
              {redeemed && <p className="msg msg--ok">This code has been redeemed by a customer. Choose “Start next purchase” for the next sale.</p>}
              {expired && <p className="msg msg--error">This code has expired. Choose “Start next purchase”, then issue a new one.</p>}
              {!redeemed && !expired && (
                <p className="muted small">Works once. Expires at {timeOf(current.expires_at)} (15 minutes after it was issued).</p>
              )}
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
              <button className="btn btn--dark" type="submit" disabled={busy || !rewardMobile.trim()}>Mark free drink as given</button>
            </form>
            {rewardResult && (
              <p className={rewardResult.ok ? "msg msg--ok" : "msg msg--error"} role="status">{rewardResult.message}</p>
            )}
          </div>

          <div className="subsection">
            <h3>Test data</h3>
            <p>
              Create three clearly marked demo customers to try the system. Demo records are flagged in the
              database and never touch real customers.
            </p>
            <div className="row">
              <button className="btn btn--dark" type="button" disabled={busy} onClick={() => demo(true)}>Create demo customers</button>
              <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => demo(false)}>Remove demo customers</button>
            </div>
            {demoResult && !demoResult.ok && <p className="msg msg--error" role="status">{demoResult.message}</p>}
            {demoResult?.ok && demoResult.created && (
              <ul className="plain-list" role="status">
                {DEMO_LIST.map(([n, name, d]) => (
                  <li key={n}>{n}: {name} ({d})</li>
                ))}
              </ul>
            )}
            {demoResult?.ok && !demoResult.created && <p className="msg msg--ok" role="status">Demo customers removed.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
