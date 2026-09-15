/**
 * src/loemart/mobile/MobileSections.jsx
 */
import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FiZap, FiClock, FiStar, FiShield, FiTruck, 
  FiAward, FiCreditCard, FiTrendingUp, FiGift 
} from "react-icons/fi";
import { fmtPrice, calcDiscount, primaryImg, useCountdown, addToRecentlyViewed } from "./mobileHelpers";

// Smart text truncation
function smartTruncate(text, maxChars = 40) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  let cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > 0) cut = cut.slice(0, lastSpace);
  return cut.trim() + "…";
}

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
  const navigate = useNavigate();
  return (
    <div className="lmm-promo-wrap">
      <div className="lmm-promo-banner" onClick={() => navigate("/catalog?sort=views")}>
        <div className="lmm-promo-content">
          <h4>Weekend Tech Drop</h4>
          <p>Up to 40% off premium gadgets.</p>
        </div>
        <button className="lmm-promo-btn">Shop Now</button>
      </div>
    </div>
  );
});

/* ── 3. REUSABLE HORIZONTAL RAIL CARD ── */
const RailCard = memo(function RailCard({ item }) {
  const navigate = useNavigate();
  const img = primaryImg(item.images, item);
  const d = calcDiscount(item);
  const title = smartTruncate(item.name || item.title, 40);

  return (
    <div 
      className="mdp-rail-hcard" 
      onClick={() => { 
        addToRecentlyViewed(item); 
        navigate(`/shop/${item.slug ?? item.id}`); 
      }}
    >
      <div className="mdp-rail-hcard__media">
        {img ? <img src={img} alt="" loading="lazy" /> : <div className="mdp-rail-hcard__ph">📦</div>}
        {d > 0 && <span className="mdp-rail-hcard__badge">-{d}%</span>}
      </div>
      <div className="mdp-rail-hcard__body">
        <h4 className="mdp-rail-hcard__name">{title}</h4>
        <div className="mm-card-bottom">
          <span className="mdp-rail-hcard__price">{fmtPrice(item.price || item.selling_price)}</span>
        </div>
      </div>
    </div>
  );
});

/* ── 4. DYNAMIC SECTIONS ── */

// Flash Deals (Includes Timer)
const FlashDealsSection = memo(function FlashDealsSection({ deals = [] }) {
  const tonight = new Date();
  tonight.setHours(23, 59, 59, 999);
  const { h, m, s } = useCountdown(tonight.toISOString());

  if (!deals.length) return null;

  return (
    <section className="mdp-psec">
      <div className="mdp-psec__head">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FiZap size={18} color="#ff6b00" />
          <h3 className="mdp-psec__title">Daily Flash Sale</h3>
        </div>
        <div className="lmm-countdown" style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#e53935", fontWeight: "bold" }}>
          <FiClock size={12} />
          <span>{h}:{m}:{s}</span>
        </div>
      </div>
      <div className="mdp-rail-hscroll">
        {deals.map(item => <RailCard key={item.id} item={item} />)}
      </div>
    </section>
  );
});

// Generic Curated Rail (For New, Featured, Trending)
const CuratedRail = memo(function CuratedRail({ title, items = [], icon: Icon }) {
  if (!items.length) return null;
  return (
    <section className="mdp-psec">
      <div className="mdp-psec__head">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {Icon && <Icon size={18} color="#ff6b00" />}
          <h3 className="mdp-psec__title">{title}</h3>
        </div>
      </div>
      <div className="mdp-rail-hscroll">
        {items.map(item => <RailCard key={item.id} item={item} />)}
      </div>
    </section>
  );
});


/* ── MAIN EXPORT ── */
export default memo(function MobileSections({ flashDeals = [], newArrivals = [], featured = [], trending = [] }) {
  return (
    <div className="lmm-curated-sections-container">
      <TrustStrip />
      <PromoBanner />
      
      {/* 1. Flash Deals */}
      <FlashDealsSection deals={flashDeals} />

      {/* 2. Hot Sales / Trending */}
      <CuratedRail title="Hot Sales" items={trending} icon={FiTrendingUp} />

      {/* 3. New Arrivals */}
      <CuratedRail title="New Arrivals" items={newArrivals} icon={FiGift} />

      {/* 4. Featured Listings */}
      <CuratedRail title="Featured Listings" items={featured} icon={FiStar} />
    </div>
  );
});