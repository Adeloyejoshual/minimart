import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { FiZap, FiClock, FiStar, FiShield, FiTruck, FiAward, FiCreditCard } from "react-icons/fi";
import { fmtPrice, calcDiscount, primaryImg, useCountdown, addToRecentlyViewed } from "./mobileHelpers";

/* ── 1. TRUST STRIP ── */
const TrustStrip = memo(function TrustStrip() {
  const items = [
    { icon: FiShield, label: "Secure Pay" },
    { icon: FiTruck, label: "Fast Delivery" },
    { icon: FiAward, label: "Top Quality" },
    { icon: FiCreditCard, label: "Money Back" },
  ];
  return (
    <div className="lmm-trust-strip">
      {items.map((it, i) => (
        <div key={i} className="lmm-trust-item">
          <it.icon size={16} className="lmm-trust-icon" />
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
});

/* ── 2. PROMO BANNER ── */
const PromoBanner = memo(function PromoBanner() {
  return (
    <div className="lmm-promo-wrap">
      <div className="lmm-promo-banner">
        <div className="lmm-promo-content">
          <h4>Weekend Tech Drop</h4>
          <p>Up to 40% off premium gadgets.</p>
        </div>
        <button className="lmm-promo-btn">Shop Now</button>
      </div>
    </div>
  );
});

/* ── 3. FLASH DEALS ── */
const FlashDealsSection = memo(function FlashDealsSection({ deals = [] }) {
  const navigate = useNavigate();
  const tonight = new Date();
  tonight.setHours(23, 59, 59, 999);
  const { h, m, s } = useCountdown(tonight.toISOString());

  if (!deals.length) return null;

  return (
    <section className="lmm-flash-section">
      <div className="lmm-flash-header">
        <div className="lmm-flash-title-wrap">
          <div className="lmm-flash-icon"><FiZap size={18} /></div>
          <div>
            <h3 className="lmm-section-title text-white">Daily Flash Sale</h3>
          </div>
        </div>
        <div className="lmm-countdown">
          <FiClock size={12} />
          <div className="lmm-countdown-timer">
            <span>{h}</span>:<span>{m}</span>:<span>{s}</span>
          </div>
        </div>
      </div>
      <div className="lmm-hscroll-track">
        {deals.map((item) => {
          const img = primaryImg(item.images, item);
          const d = calcDiscount(item);
          return (
            <div key={item.id} className="lmm-mini-card" onClick={() => { addToRecentlyViewed(item); navigate(`/shop/${item.slug ?? item.id}`); }}>
              <div className="lmm-mini-card__img-wrap">
                {img ? <img src={img} alt="" loading="lazy" /> : <div className="lmm-mini-card__ph">📦</div>}
                {d > 0 && <span className="lmm-mini-card__discount">-{d}%</span>}
              </div>
              <div className="lmm-mini-card__body">
                <h4 className="lmm-mini-card__name">{item.name}</h4>
                <span className="lmm-mini-card__price">{fmtPrice(item.price)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});

/* ── MAIN EXPORT ── */
export default memo(function MobileSections({ featured = [], flashDeals = [] }) {
  return (
    <div className="lmm-curated-sections-container">
      <TrustStrip />
      <PromoBanner />
      <FlashDealsSection deals={flashDeals} />
      {/* We keep it to ONE strong rail here to avoid fatigue */}
    </div>
  );
});