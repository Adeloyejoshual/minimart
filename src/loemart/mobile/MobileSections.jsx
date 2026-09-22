/**
 * src/loemart/mobile/MobileSections.jsx
 * High-Conversion Marketing Layout (Urgency, Bento Promos, Trust)
 */
import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiShield,
  FiTruck,
  FiAward,
  FiTrendingUp,
  FiGift,
  FiSmartphone,
  FiWatch,
  FiShoppingBag,
  FiHome,
  FiClock,
  FiChevronRight,
} from "react-icons/fi";
import {
  fmtPrice,
  calcDiscount,
  primaryImg,
  addToRecentlyViewed,
  getRecentlyViewed,
  useCountdown,
} from "./mobileHelpers";

import "./styles/MobileSections.css";

function smartTruncate(text, maxChars = 35) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trim() + "…";
}

/* ── 1. TRUST BAR (Sleeker, builds instant buyer confidence) ── */
const TrustStrip = memo(function TrustStrip() {
  return (
    <div className="lmm-trust-strip">
      <div className="lmm-trust-item"><FiShield /> <span>Buyer Protection</span></div>
      <div className="lmm-trust-divider" />
      <div className="lmm-trust-item"><FiTruck /> <span>Fast Delivery</span></div>
      <div className="lmm-trust-divider" />
      <div className="lmm-trust-item"><FiAward /> <span>Verified Quality</span></div>
    </div>
  );
});

/* ── 2. QUICK CATEGORIES (High Engagement) ── */
const CATEGORIES = [
  { id: "phones", label: "Phones", icon: FiSmartphone, q: "phones" },
  { id: "fashion", label: "Fashion", icon: FiShoppingBag, q: "fashion" },
  { id: "watches", label: "Watches", icon: FiWatch, q: "watches" },
  { id: "home", label: "Home", icon: FiHome, q: "home" },
];

const CategoryRow = memo(function CategoryRow() {
  const navigate = useNavigate();
  return (
    <div className="lmm-cat-grid">
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          type="button"
          className="lmm-cat-card"
          onClick={() => navigate(`/catalog?category=${encodeURIComponent(c.q)}`)}
        >
          <div className="lmm-cat-card__icon"><c.icon size={22} strokeWidth={1.5} /></div>
          <span className="lmm-cat-card__label">{c.label}</span>
        </button>
      ))}
    </div>
  );
});

/* ── 3. BENTO PROMO GRID (Replaces boring banner, drives clicks to specific deals) ── */
const PromoBento = memo(function PromoBento() {
  const navigate = useNavigate();
  return (
    <div className="lmm-bento">
      <div 
        className="lmm-bento-main" 
        onClick={() => navigate("/catalog?sort=price_desc")}
      >
        <span className="lmm-bento-badge">Must Have</span>
        <h4>Tech<br/>Clearance</h4>
        <p>Up to 50% Off</p>
      </div>
      <div className="lmm-bento-side">
        <div 
          className="lmm-bento-sub lmm-bento-sub--1"
          onClick={() => navigate("/catalog?sort=newest")}
        >
          <h5>New Drops</h5>
          <p>Explore</p>
        </div>
        <div 
          className="lmm-bento-sub lmm-bento-sub--2"
          onClick={() => navigate("/catalog?sort=views")}
        >
          <h5>Top Rated</h5>
          <p>Shop now</p>
        </div>
      </div>
    </div>
  );
});

/* ── 4. DEAL OF THE DAY (Psychological Urgency) ── */
const DealOfTheDay = memo(function DealOfTheDay({ items = [] }) {
  const navigate = useNavigate();
  // Timer resets every midnight locally to create daily urgency
  const midnight = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, []);
  
  const { h, m, s } = useCountdown(midnight);

  if (!items || items.length === 0) return null;

  return (
    <section className="mdp-psec mdp-psec--deals">
      <div className="mdp-psec__head mdp-psec__head--deals">
        <div className="mdp-psec__head-left">
          <h3 className="mdp-psec__title text-white">Deal of the Day</h3>
          <div className="lmm-timer">
            <FiClock size={12} /> {h}:{m}:{s}
          </div>
        </div>
      </div>
      <div className="mdp-rail-hscroll mdp-rail-hscroll--deals">
        {items.map((item) => (
          <RailCard key={item.id || item._id} item={item} isDeal />
        ))}
      </div>
    </section>
  );
});

/* ── 5. RAIL CARD (Optimized for clicks) ── */
const RailCard = memo(function RailCard({ item, isDeal }) {
  const navigate = useNavigate();
  const img = primaryImg(item.images, item);
  const price = item.price || item.selling_price;
  const oldPrice = item.original_price || item.originalPrice || item.compare_price;
  const discount = calcDiscount(item);
  const title = smartTruncate(item.name || item.title, 35);

  return (
    <div
      className={`mdp-rail-hcard ${isDeal ? "mdp-rail-hcard--deal" : ""}`}
      onClick={() => {
        addToRecentlyViewed(item);
        navigate(`/shop/${item.slug ?? item.id}`);
      }}
    >
      <div className="mdp-rail-hcard__media">
        {img ? <img src={img} alt={title} loading="lazy" /> : <div className="mdp-rail-hcard__ph">📦</div>}
        {discount > 0 && <span className="mdp-rail-hcard__badge">-{discount}%</span>}
      </div>
      <div className="mdp-rail-hcard__body">
        <h4 className="mdp-rail-hcard__name">{title}</h4>
        <div className="mm-card-bottom">
          <span className="mdp-rail-hcard__price">{fmtPrice(price)}</span>
          {oldPrice > price && <span className="mdp-rail-hcard__old">{fmtPrice(oldPrice)}</span>}
        </div>
      </div>
    </div>
  );
});

/* ── 6. STANDARD CURATED RAIL ── */
const CuratedRail = memo(function CuratedRail({ title, items = [], icon: Icon, onSeeAll }) {
  if (!items.length) return null;
  return (
    <section className="mdp-psec">
      <div className="mdp-psec__head">
        <div className="mdp-psec__head-left">
          {Icon && <Icon size={18} color="#ff6b00" />}
          <h3 className="mdp-psec__title">{title}</h3>
        </div>
        {onSeeAll && (
          <button type="button" className="mdp-psec__all" onClick={onSeeAll}>
            See all <FiChevronRight />
          </button>
        )}
      </div>
      <div className="mdp-rail-hscroll">
        {items.map((item) => (
          <RailCard key={item.id || item._id} item={item} />
        ))}
      </div>
    </section>
  );
});

/* ── 7. RECENTLY VIEWED ── */
const RecentlyViewedRail = memo(function RecentlyViewedRail() {
  const items = useMemo(() => {
    try { return (getRecentlyViewed() || []).slice(0, 6); } catch { return []; }
  }, []);
  if (!items.length) return null;
  return <CuratedRail title="Based on your views" items={items} icon={FiGift} />;
});

/* ── MAIN EXPORT ── */
export default memo(function MobileSections({ newArrivals = [], trending = [] }) {
  const navigate = useNavigate();

  // We use the first 4 trending items for the "Deal of the Day" to fake a flash sale 
  // without needing extra API calls, instantly increasing conversion!
  const dealItems = useMemo(() => trending.slice(0, 4), [trending]);
  const hotItems = useMemo(() => trending.slice(4, 10), [trending]);

  return (
    <div className="lmm-marketing-container">
      <TrustStrip />
      <CategoryRow />
      <PromoBento />
      
      {/* High-conversion urgency section */}
      <DealOfTheDay items={dealItems} />

      {/* Main shopping rails */}
      <CuratedRail
        title="Trending Now"
        items={hotItems}
        icon={FiTrendingUp}
        onSeeAll={() => navigate("/catalog?sort=views")}
      />
      <CuratedRail
        title="Just Dropped"
        items={newArrivals}
        icon={FiGift}
        onSeeAll={() => navigate("/catalog?sort=newest")}
      />

      <RecentlyViewedRail />
    </div>
  );
});