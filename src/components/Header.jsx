import { SHOP } from "../data/shop";
import { Bean } from "./Decor";
import Navigation from "./Navigation";

export default function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="#top">
        <Bean size={26} />
        <span>{SHOP.name}</span>
      </a>
      <Navigation />
    </header>
  );
}
