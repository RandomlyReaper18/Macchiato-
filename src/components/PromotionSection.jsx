import { MENU } from "../data/menu";
import { Cat, Cup } from "./Decor";

export default function PromotionSection() {
  return (
    <section className="section" id="rewards">
      <div className="wrap promo">
        <div className="promo__cat">
          <p className="bubble">ME AFTER MY 10TH STAMP</p>
          <Cat />
        </div>
        <div className="collage" aria-label="Ten drinks from the menu">
          {MENU.slice(0, 10).map((m) => (
            <div key={m.id} className="tile" style={{ background: m.tint }}>
              <Cup color="#F4E8CD" />
              <span>{m.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
