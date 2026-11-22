import { SHOP } from "../data/shop";
import { Bean } from "./Decor";

export default function HeroSection() {
  return (
    <section className="section" id="top">
      <div className="wrap">
        <div className="paper paper--ticket hero">
          <div className="hero__beans" aria-hidden="true">
            <Bean size={22} /><Bean size={16} /><Bean size={20} />
          </div>
          <h1>Collect {SHOP.stampsPerCard} cups, and the next one is on us.</h1>
          <p>
            Every drink gets you a stamp. Ask the staff for your one-time code,
            add it to your card, and watch the circles fill up.
          </p>
          <div className="row">
            <a className="btn" href="#card">Check my card</a>
            <a className="btn btn--ghost" href="#menu">See the menu</a>
          </div>
        </div>
      </div>
    </section>
  );
}
