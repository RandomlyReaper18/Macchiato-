import { useState } from "react";
import { api } from "./logic/api.js";
import { useDbStatus } from "./logic/useDbStatus.js";
import { useStaffSession } from "./logic/useStaffSession.js";
import Header from "./components/Header";
import HeroSection from "./components/HeroSection";
import MenuSection from "./components/MenuSection";
import LoyaltyCard from "./components/LoyaltyCard";
import RedeemCodePanel from "./components/RedeemCodePanel";
import StaffSection from "./components/StaffSection";
import PromotionSection from "./components/PromotionSection";
import Footer from "./components/Footer";

// Everything that matters (customers, codes, stamps, rewards) lives in the
// database and is decided by it. This component only holds what is on screen.
export default function App() {
  const [summary, setSummary] = useState(null);
  const db = useDbStatus();
  const staff = useStaffSession();
  const isLoginPage = window.location.pathname === "/login";

  const lookup = async (raw) => {
    const result = await api.lookup(raw);
    setSummary(result.ok ? result.summary : null);
    return result;
  };

  const enroll = async (data) => {
    const result = await api.enroll(data);
    if (result.ok) setSummary(result.summary);
    return { ...result, customer: result.summary?.customer };
  };

  const redeem = async (code) => {
    if (!summary) return { ok: false, message: "Load your loyalty card first." };
    const result = await api.redeem(summary.customer.mobile_number, code);
    if (!result.ok) return result;
    setSummary(result.summary);
    return {
      ok: true,
      message: result.reward_earned
        ? `+1 cup added for ${result.drink_name}. Card complete: you’ve earned a free drink!`
        : `+1 cup added for ${result.drink_name}.`,
    };
  };

  return (
    <>
      <Header />
      <main>
        {isLoginPage ? (
          <section className="section" id="staff">
            <div className="wrap wrap--narrow">
              <StaffSection staff={staff} api={api} />
            </div>
          </section>
        ) : (
          <>
            <HeroSection />
            <MenuSection />
            <section className="section" id="card">
              <div className="wrap two-col">
                <LoyaltyCard summary={summary} onLookup={lookup} onEnroll={enroll} />
                <RedeemCodePanel onRedeem={redeem} />
              </div>
            </section>
            <PromotionSection />
          </>
        )}
      </main>
      <Footer db={db} />
    </>
  );
}
