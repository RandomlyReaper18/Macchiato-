import { SHOP } from "../data/shop";
import DbStatus from "./DbStatus";

export default function Footer({ db }) {
  return (
    <footer className="site-footer">
      <p>{SHOP.name}</p>
      <DbStatus state={db.state} label={db.label} detail={db.detail} onRecheck={db.recheck} />
    </footer>
  );
}
