import { useState } from "react";
import { customerSummary } from "./logic/customerService.js";
import { checkCode, drinkById, issueCode, maskMobile, normalizeMobile } from "./logic/loyalty.js";
import { useLoyaltyStore } from "./logic/useLoyaltyStore.js";
import Header from "./components/Header";
import HeroSection from "./components/HeroSection";
import MenuSection from "./components/MenuSection";
import LoyaltyCard from "./components/LoyaltyCard";
import RedeemCodePanel from "./components/RedeemCodePanel";
import StaffCodePanel from "./components/StaffCodePanel";
import PromotionSection from "./components/PromotionSection";
import Footer from "./components/Footer";

// Customer records (lookup, enrollment, purchases, rewards) now go through the
// store. Purchase CODES are still the Phase 1 in-memory demo until Phase 3.
export default function App() {
  const store = useLoyaltyStore();
  const [codes, setCodes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [demoKey, setDemoKey] = useState(0);

  const customer = store.state.customers.find((c) => c.id === activeId) || null;
  const summary = customer ? customerSummary(store.state, customer) : null;

  const lookup = (raw) => {
    const result = store.lookup(raw);
    setActiveId(result.ok ? result.customer.id : null);
    return result;
  };

  const enroll = (data) => {
    const result = store.enroll(data);
    if (result.ok) setActiveId(result.customer.id);
    return result;
  };

  const issue = (drinkId) => {
    // Never reuse a code that is already in a customer's history.
    const taken = [...codes, ...store.state.purchases.map((p) => ({ code: p.purchase_code }))];
    const entry = issueCode(taken, drinkId);
    setCodes((prev) => [...prev, entry]);
    return entry;
  };

  const redeem = (input) => {
    if (!customer) return { ok: false, message: "Load your loyalty card first." };
    const checked = checkCode(codes, input);
    if (!checked.ok) return checked;
    const { entry } = checked;
    const drink = drinkById(entry.drinkId);
    const recorded = store.recordPurchase({
      customerId: customer.id,
      drinkId: entry.drinkId,
      drinkName: drink.name,
      code: entry.code,
      purchasedAt: new Date(entry.issuedAt).toISOString(),
    });
    if (!recorded.ok) return recorded;
    setCodes((prev) => prev.map((c) => (c.code === entry.code ? { ...c, redeemedAt: Date.now() } : c)));
    return {
      ok: true,
      message: recorded.rewardEarned
        ? `+1 cup added for ${drink.name}. Card complete: you’ve earned a free drink!`
        : `+1 cup added for ${drink.name}.`,
    };
  };

  const giveReward = (mobile) => {
    const result = store.giveRewardTo(mobile);
    return result.ok
      ? { ok: true, message: `Free drink marked as given for ${maskMobile(normalizeMobile(mobile))}.` }
      : result;
  };

  const resetDemo = () => {
    store.reset();
    setCodes([]);
    setActiveId(null);
    setDemoKey((k) => k + 1);
  };

  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <MenuSection />
        <section className="section" id="card">
          <div className="wrap two-col" key={demoKey}>
            <LoyaltyCard summary={summary} persisted={store.persisted} onLookup={lookup} onEnroll={enroll} />
            <RedeemCodePanel onRedeem={redeem} />
          </div>
        </section>
        <section className="section" id="staff">
          <div className="wrap wrap--narrow">
            <StaffCodePanel key={demoKey} onIssue={issue} onGiveReward={giveReward} />
          </div>
        </section>
        <PromotionSection />
      </main>
      <Footer onReset={resetDemo} />
    </>
  );
}
