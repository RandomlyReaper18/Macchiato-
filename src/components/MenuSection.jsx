import { MENU } from "../data/menu";
import MenuCard from "./MenuCard";

export default function MenuSection() {
  return (
    <section className="section" id="menu">
      <div className="wrap">
        <h2 className="paper menu-title"><span>Menu</span></h2>
        <div className="menu-grid">
          {MENU.map((item) => (
            <MenuCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
