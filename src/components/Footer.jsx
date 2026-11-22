import { SHOP } from "../data/shop";

export default function Footer({ onReset }) {
  return (
    <footer className="site-footer">
      <p>{SHOP.name}</p>
      <p className="small">
        Demo build: customer records are saved in this browser only (localStorage), not in a shared database.
      </p>
      <button className="btn btn--ghost btn--light" type="button" onClick={onReset}>
        Reset demo data
      </button>
    </footer>
  );
}
