const SHOWN = 8;
const when = (iso) => new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });

export default function PurchaseHistory({ purchases }) {
  return (
    <div className="subsection">
      <h3>Purchase history</h3>
      {purchases.length === 0 ? (
        <p className="muted">No purchases yet. Add your first cup with a code from staff.</p>
      ) : (
        <>
          <ul className="history">
            {purchases.slice(0, SHOWN).map((p) => (
              <li key={p.id}>
                <span className="history__drink">{p.drink_name}</span>
                <span className="history__meta">{when(p.purchased_at)} · code {p.purchase_code}</span>
                <span className="history__status">Redeemed</span>
              </li>
            ))}
          </ul>
          {purchases.length > SHOWN && (
            <p className="muted small">Showing the latest {SHOWN} of {purchases.length} purchases.</p>
          )}
        </>
      )}
    </div>
  );
}
