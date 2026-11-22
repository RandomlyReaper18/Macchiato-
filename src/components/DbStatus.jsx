// Small connection indicator. The state comes from a real database request
// (see useDbStatus); pressing it checks again.
export default function DbStatus({ state, label, detail, onRecheck }) {
  return (
    <div className="db-status" role="status" aria-live="polite">
      <button
        type="button"
        className={`db-status__btn db-status--${state}`}
        onClick={onRecheck}
        title="Check the database connection again"
      >
        <span className="db-dot" aria-hidden="true" />
        {label}
      </button>
      {detail && <p className="small db-status__detail">{detail}</p>}
    </div>
  );
}
