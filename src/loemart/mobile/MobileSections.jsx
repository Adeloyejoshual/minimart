/**
 * src/loemart/mobile/MobileSections.jsx
 * High-conversion marketing block — placed AFTER MobileHero
 *
 * Props (from Minimart /products/home):
 *  - deals            → Deal of the Day (real discounts)
 *  - trending | hot   → Hot / trending rail
 *  - newArrivals      → Just Dropped
 *  - campaignTitle    → Admin campaign name e.g. "December Deals"
 *  - campaignProducts → Products tagged with that campaign
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
  FiZap,
  FiTag,
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
  const s = String(text).trim();
  if (s.length <= maxChars) return s;
  const cut = s.slice(0, maxChars);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > 12 ? cut.slice(0, sp) : cut).trim()}…`;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ════════════════════════════════════════════════════════════
   1. TRUST STRIP
════════════════════════════════════════════════════════════ */
const TrustStrip = memo(function TrustStrip() {
  return (
    <div className="lmm-trust-strip" aria-label="Shopping guarantees">
      <div className="lmm-trust-item">
        <FiShield aria-hidden />
        <span>Buyer Protection</span>
      </div>
      <div className="lmm-trust-divider" aria-hidden />
      <div className="lmm-trust-item">
        <FiTruck aria-hidden />
        <span>Fast Delivery</span>
      </div>
      <div className="lmm-trust-divider" aria-hidden />
      <div className="lmm-trust-item">
        <FiAward aria-hidden />
        <span>Verified Quality</span>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   2. CATEGORY GRID
════════════════════════════════════════════════════════════ */
const CATEGORIES = [
  { id: "phones", label: "Phones", icon: FiSmartphone, q: "phones" },
  { id: "fashion", label: "Fashion", icon: FiShoppingBag, q: "fashion" },
  { id: "watches", label: "Watches", icon: FiWatch, q: "watches" },
  { id: "home", label: "Home", icon: FiHome, q: "home" },
];

const CategoryRow = memo(function CategoryRow() {
  const navigate = useNavigate();

  return (
    <div className="lmm-cat-grid" aria-label="Shop by category">
      {CATEGORIES.map((c) => {
        const Icon = c.icon;
        return (
          <button
            key={c.id}
            type="button"
            className="lmm-cat-card"
            onClick={() =>
              navigate(`/catalog?category=${encodeURIComponent(c.q)}`)
            }
          >
            <div className="lmm-cat-card__icon">
              <Icon size={22} strokeWidth={1.5} aria-hidden />
            </div>
            <span className="lmm-cat-card__label">{c.label}</span>
          </button>
        );
      })}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   3. BENTO PROMO GRID
════════════════════════════════════════════════════════════ */
const PromoBento = memo(function PromoBento() {
  const navigate = useNavigate();

  return (
    <div className="lmm-bento" aria-label="Featured promotions">
      <button
        type="button"
        className="lmm-bento-main"
        onClick={() => navigate("/catalog?deal=true&sort=deal")}
      >
        <span className="lmm-bento-badge">Must Have</span>
        <h4>
          Tech
          <br />
          Clearance
        </h4>
        <p>Up to 50% Off</p>
      </button>

      <div className="lmm-bento-side">
        <button
          type="button"
          className="lmm-bento-sub lmm-bento-sub--1"
          onClick={() => navigate("/catalog?sort=newest")}
        >
          <h5>New Drops</h5>
          <p>Explore</p>
        </button>
        <button
          type="button"
          className="lmm-bento-sub lmm-bento-sub--2"
          onClick={() => navigate("/catalog?sort=bestselling")}
        >
          <h5>Bestsellers</h5>
          <p>Shop now</p>
        </button>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   4. RAIL CARD
════════════════════════════════════════════════════════════ */
const RailCard = memo(function RailCard({ item, isDeal = false }) {
  const navigate = useNavigate();

  const img = primaryImg(item?.images, item);
  const price = num(item?.price ?? item?.selling_price);
  const oldPrice = num(
    item?.original_price ??
      item?.originalPrice ??
      item?.compare_at_price ??
      item?.compare_price ??
      item?.old_price
  );
  const discount = calcDiscount(item);
  const title = smartTruncate(item?.name || item?.title, 35);
  const badge = item?.badge ? String(item.badge).trim() : "";

  const go = () => {
    addToRecentlyViewed(item);
    navigate(`/shop/${item?.slug ?? item?.id}`);
  };

  return (
    <div
      className={`mdp-rail-hcard${isDeal ? " mdp-rail-hcard--deal" : ""}`}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="mdp-rail-hcard__media">
        {img ? (
          <img src={img} alt={title} loading="lazy" />
        ) : (
          <div className="mdp-rail-hcard__ph" aria-hidden>
            📦
          </div>
        )}

        {discount > 0 && (
          <span className="mdp-rail-hcard__badge">-{discount}%</span>
        )}

        {badge && !discount && (
          <span className="mdp-rail-hcard__badge mdp-rail-hcard__badge--soft">
            {badge}
          </span>
        )}
      </div>

      <div className="mdp-rail-hcard__body">
        <h4 className="mdp-rail-hcard__name">{title}</h4>
        <div className="mm-card-bottom">
          <span className="mdp-rail-hcard__price">{fmtPrice(price)}</span>
          {oldPrice > price && price > 0 && (
            <span className="mdp-rail-hcard__old">{fmtPrice(oldPrice)}</span>
          )}
        </div>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   5. DEAL OF THE DAY (urgency)
════════════════════════════════════════════════════════════ */
const DealOfTheDay = memo(function DealOfTheDay({ items = [] }) {
  const navigate = useNavigate();

  const midnight = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, []);

  const { h, m, s } = useCountdown(midnight);

  if (!items.length) return null;

  return (
    <section className="mdp-psec mdp-psec--deals" aria-label="Deal of the Day">
      <div className="mdp-psec__head mdp-psec__head--deals">
        <div className="mdp-psec__head-left">
          <FiZap size={16} color="#dc2626" aria-hidden />
          <h3 className="mdp-psec__title mdp-psec__title--deal">
            Deal of the Day
          </h3>
          <div className="lmm-timer" aria-live="polite">
            <FiClock size={12} aria-hidden />
            <span>
              {h}:{m}:{s}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="mdp-psec__all"
          onClick={() => navigate("/catalog?deal=true&sort=deal")}
        >
          See all <FiChevronRight size={14} aria-hidden />
        </button>
      </div>

      <div className="mdp-rail-hscroll mdp-rail-hscroll--deals">
        {items.map((item) => (
          <RailCard
            key={item.id || item._id || item.slug}
            item={item}
            isDeal
          />
        ))}
      </div>
    </section>
  );
});

/* ════════════════════════════════════════════════════════════
   6. CURATED RAIL
════════════════════════════════════════════════════════════ */
const CuratedRail = memo(function CuratedRail({
  title,
  items = [],
  icon: Icon,
  onSeeAll,
  tone = "default",
}) {
  if (!items.length) return null;

  return (
    <section
      className={`mdp-psec${tone === "campaign" ? " mdp-psec--campaign" : ""}`}
    >
      <div className="mdp-psec__head">
        <div className="mdp-psec__head-left">
          {Icon ? <Icon size={18} color="#ff6b00" aria-hidden /> : null}
          <h3 className="mdp-psec__title">{title}</h3>
        </div>
        {onSeeAll ? (
          <button type="button" className="mdp-psec__all" onClick={onSeeAll}>
            See all <FiChevronRight size={14} aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="mdp-rail-hscroll">
        {items.map((item) => (
          <RailCard key={item.id || item._id || item.slug} item={item} />
        ))}
      </div>
    </section>
  );
});

/* ════════════════════════════════════════════════════════════
   7. RECENTLY VIEWED (local only)
════════════════════════════════════════════════════════════ */
const RecentlyViewedRail = memo(function RecentlyViewedRail() {
  const items = useMemo(() => {
    try {
      return (getRecentlyViewed() || []).slice(0, 8);
    } catch {
      return [];
    }
  }, []);

  if (!items.length) return null;

  return (
    <CuratedRail title="Based on your views" items={items} icon={FiGift} />
  );
});

/* ════════════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════════════ */
function MobileSections({
  deals = [],
  trending = [],
  hot = [],
  newArrivals = [],
  campaignTitle = null,
  campaignProducts = [],
}) {
  const navigate = useNavigate();

  /** Prefer real discounted deals from API; fallback to first hot items */
  const dealItems = useMemo(() => {
    if (Array.isArray(deals) && deals.length) return deals.slice(0, 8);
    const pool = (hot?.length ? hot : trending) || [];
    return pool.slice(0, 4);
  }, [deals, hot, trending]);

  const hotItems = useMemo(() => {
    const pool = (hot?.length ? hot : trending) || [];
    // If we borrowed from pool for deals fallback, skip overlap when same source
    if (Array.isArray(deals) && deals.length) return pool.slice(0, 10);
    return pool.slice(4, 12);
  }, [deals, hot, trending]);

  const campaignItems = useMemo(
    () => (Array.isArray(campaignProducts) ? campaignProducts.slice(0, 10) : []),
    [campaignProducts]
  );

  const campaignName =
    (campaignTitle && String(campaignTitle).trim()) ||
    campaignItems[0]?.campaign_tag ||
    null;

  return (
    <div className="lmm-marketing-container">
      <TrustStrip />
      <CategoryRow />
      <PromoBento />

      {/* Real or fallback urgency rail */}
      <DealOfTheDay items={dealItems} />

      {/* Admin-defined campaign e.g. "December Deals" */}
      {campaignName && campaignItems.length > 0 && (
        <CuratedRail
          title={campaignName}
          items={campaignItems}
          icon={FiTag}
          tone="campaign"
          onSeeAll={() =>
            navigate(
              `/catalog?campaign=${encodeURIComponent(campaignName)}`
            )
          }
        />
      )}

      <CuratedRail
        title="Trending Now"
        items={hotItems}
        icon={FiTrendingUp}
        onSeeAll={() => navigate("/catalog?sort=bestselling")}
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
}

export default memo(MobileSections);