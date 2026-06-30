/**
 * src/pages/P2P.jsx
 * Route: /p2p
 *
 * Peer-to-peer trading page:
 * - Browse active trade offers (sell / swap / free)
 * - Post a trade offer (modal)
 * - Offer-type filter chips
 * - "Match Me" smart pairing suggestion
 * - Masonry-style offer cards with avatar, badge, distance
 * - Online green dot on seller avatars
 * - Session-personalised ranking (recentCategories)
 * - Mid-feed inject every 10 items
 * - Movement-aware + 30-min refresh
 */

import {
  useEffect, useState, useCallback, useRef, memo, useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import TopNav          from "../components/TopNav";
import BottomNav       from "../components/BottomNav";
import Footer          from "../components/Footer";
import LocationPicker    from "../components/LocationPicker";
import { getActiveLocation } from "../hooks/useLocation";
import CATEGORY_CONFIG from "../config/categories";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const PH             = "https://placehold.co/600x500/e8e4dc/b0a89e?text=No+Image";
const ITEMS_PER_PAGE = 24;
const PROMO_INTERVAL = 10;
const REFRESH_MS     = 1_800_000;
const MOVE_CHECK_MS  = 300_000;
const MOVE_THRESHOLD = 2;

const GPS_OPTIONS = {
  timeout            : 5_000,
  enableHighAccuracy : false,
  maximumAge         : 300_000,
};

const OFFER_TYPES = [
  { key: "all",  label: "All Offers",   icon: "✦" },
  { key: "sell", label: "For Sale",     icon: "💰" },
  { key: "swap", label: "Swap / Trade", icon: "🔄" },
  { key: "free", label: "Free",         icon: "🎁" },
];

const SORT_OPTS = [
  { key: "smart",      label: "Best Match" },
  { key: "newest",     label: "Newest"     },
  { key: "price_asc",  label: "Price ↑"   },
  { key: "price_desc", label: "Price ↓"   },
];

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE PRODUCT
   API returns string numbers — convert all to real numbers
═══════════════════════════════════════════════════════════════ */
const normalizeProduct = (p) => {
  if (!p || typeof p !== "object" || !p.id) return null;
  return {
    ...p,
    price             : Number(p.price             || 0),
    engagement_score  : Number(p.engagement_score  || 0),
    clicks_count      : Number(p.clicks_count      || 0),
    impression_count  : Number(p.impression_count  || 0),
    views             : Number(p.views             || 0),
    ctr               : Number(p.ctr               || 0),
    promotion_priority: Number(p.promotion_priority || 0),
    is_promoted       : !!p.is_promoted,

    // Normalize image
    image: p.image ||
      (Array.isArray(p.images) && p.images.length > 0
        ? (typeof p.images[0] === "string" ? p.images[0] : p.images[0]?.url || null)
        : null) ||
      p.main_image    ||
      p.thumbnail_url ||
      null,

    // Normalize location
    location_city  : p.location?.city  || p.location_city  || null,
    location_state : p.location?.state || p.location_state || null,
  };
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
};

const getRecentCategories = () => {
  try { return JSON.parse(localStorage.getItem("recentCategories") || "[]"); }
  catch { return []; }
};

const personalScore = (p, recentCats) => {
  if (!p) return 0;
  let score = 0;
  score += (p.engagement_score    || 0);
  score += (p.is_promoted ? 50    : 0);
  score += ((p.promotion_priority || 0) * 5);
  score += ((p.ctr                || 0) * 30);
  if (p.category_id && recentCats.includes(p.category_id)) score += 20;
  return score;
};

const applySort = (arr, key, recentCats) => {
  if (key === "newest")     return [...arr].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  if (key === "price_asc")  return [...arr].sort((a, b) => (a.price || 0) - (b.price || 0));
  if (key === "price_desc") return [...arr].sort((a, b) => (b.price || 0) - (a.price || 0));
  return [...arr].sort((a, b) => personalScore(b, recentCats) - personalScore(a, recentCats));
};

const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R    = 6_371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const injectPromoted = (products, promoted, interval = PROMO_INTERVAL) => {
  if (!promoted.length) return products;
  const result  = [];
  let promoIdx  = 0;
  const usedIds = new Set(products.map((p) => p?.id).filter(Boolean));

  for (let i = 0; i < products.length; i++) {
    if (products[i]) result.push(products[i]);
    if ((i + 1) % interval === 0) {
      while (promoIdx < promoted.length && usedIds.has(promoted[promoIdx]?.id)) promoIdx++;
      if (promoIdx < promoted.length && promoted[promoIdx]) {
        result.push({ ...promoted[promoIdx], _injected: true });
        usedIds.add(promoted[promoIdx].id);
        promoIdx++;
      }
    }
  }
  return result;
};

const heroLocation = (meta) => {
  const city  = meta?.location_city  || meta?.city;
  const state = meta?.location_state || meta?.state;
  if (city && state) return `${city}, ${state}`;
  return city || state || meta?.location || null;
};

const timeAgo = (dateStr) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m    = Math.floor(diff / 60_000);
  if (m < 1)  return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const getOfferBadge = (product) => {
  if (!product) return { label: null, cls: "" };
  if (product.offer_type === "free" || product.price === 0)
    return { label: "FREE", cls: "badge--free" };
  if (product.offer_type === "swap")
    return { label: "SWAP", cls: "badge--swap" };
  return { label: null, cls: "" };
};

/* ═══════════════════════════════════════════════════════════════
   PIN ICON
═══════════════════════════════════════════════════════════════ */
const PinIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
    aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════════ */
const SkeletonGrid = () => (
  <div className="p2p-grid">
    {[...Array(8)].map((_, i) => (
      <div key={i} className="p2p-sk" style={{ height: `${200 + (i % 3) * 60}px` }} />
    ))}
  </div>
);

const SkeletonRow = () => (
  <div className="p2p-row">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="p2p-sk p2p-sk--row" />
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   SECTION HEADER
═══════════════════════════════════════════════════════════════ */
const SectionHead = memo(({ title, chip, sub, onSeeAll }) => (
  <div className="p2p-sec-head">
    <div className="p2p-sec-label">
      <span className="p2p-sec-title">{title}</span>
      {chip && <span className="p2p-sec-chip">{chip}</span>}
      {sub  && <span className="p2p-sec-sub">{sub}</span>}
    </div>
    {onSeeAll && (
      <button className="p2p-see-all" onClick={onSeeAll}>See all →</button>
    )}
  </div>
));

/* ═══════════════════════════════════════════════════════════════
   OFFER CARD — with online green dot
═══════════════════════════════════════════════════════════════ */
const OfferCard = memo(function OfferCard({ product, onClick, onView, priority = false, horizontal = false }) {
  const cardRef = useRef(null);

  // ── View tracking ─────────────────────────────────────────
  useEffect(() => {
    if (!onView || !cardRef.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { onView(product.id); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(cardRef.current);
    return () => obs.disconnect();
  }, [onView, product.id]);

  if (!product) return null;

  const badge      = getOfferBadge(product);
  const imageUrl   = product.image || PH;
  const sellerName = product.seller_name || product.user?.name || "Seller";
  const initials   = sellerName.slice(0, 2).toUpperCase();
  const isOnline   = product.seller_is_online || product.user?.is_online || false;
  const locCity    = product.location_city || product.location?.city || "";
  const dist       = product.distance_km != null
    ? (product.distance_km < 1 ? "<1 km" : `${Math.round(product.distance_km)} km`)
    : null;

  return (
    <div
      ref={cardRef}
      className={`p2p-card${product._injected ? " p2p-card--promo" : ""}${horizontal ? " p2p-card--h" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(product); }}
    >
      {/* ── Image ── */}
      <div className="p2p-card-img-wrap">
        <img
          className="p2p-card-img"
          src={imageUrl}
          alt={product.title || "Product"}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={(e) => { e.currentTarget.src = PH; }}
        />

        {/* Offer type badge */}
        {badge.label && (
          <span className={`p2p-badge ${badge.cls}`}>{badge.label}</span>
        )}

        {/* Ad badge */}
        {product._injected && (
          <span className="p2p-badge p2p-badge--ad">Ad</span>
        )}

        {/* Featured badge */}
        {product.is_promoted && !product._injected && (
          <span className="p2p-badge p2p-badge--promo">⚡ Featured</span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="p2p-card-body">
        <p className="p2p-card-title">{product.title || "Untitled"}</p>

        {/* Price */}
        <div className="p2p-card-price">
          {product.offer_type === "free" || product.price === 0
            ? <span className="p2p-price-free">Free</span>
            : product.offer_type === "swap"
              ? <span className="p2p-price-swap">Open to offers</span>
              : <span className="p2p-price-val">{naira(product.price)}</span>
          }
        </div>

        {/* Seller row with online dot */}
        <div className="p2p-card-seller">
          <div className="p2p-avatar-wrap">
            {/* Avatar */}
            <div
              className="p2p-avatar"
              style={{
                background: `hsl(${sellerName.charCodeAt(0) * 7 % 360}, 55%, 50%)`,
              }}
            >
              {initials}
            </div>
            {/* ✅ Online green dot */}
            {isOnline && <span className="p2p-online-dot" />}
          </div>
          <span className="p2p-seller-name">{sellerName}</span>
        </div>

        {/* Location + distance */}
        <div className="p2p-card-loc-row">
          {dist && (
            <span className="p2p-dist">
              <PinIcon size={10} /> {dist}
            </span>
          )}
          {locCity && (
            <span className="p2p-city">{locCity}</span>
          )}
        </div>

        {/* Footer */}
        <div className="p2p-card-foot">
          <span className="p2p-time">{timeAgo(product.created_at)}</span>
          {product.views > 0 && (
            <span className="p2p-views">👁 {product.views}</span>
          )}
        </div>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   POST OFFER MODAL
═══════════════════════════════════════════════════════════════ */
const PostOfferModal = memo(function PostOfferModal({ open, onClose, onSubmit }) {
  const [form,   setForm]   = useState({
    title       : "",
    price       : "",
    category    : "",
    offer_type  : "sell",
    description : "",
  });
  const [busy,   setBusy]   = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title    = "Title is required";
    if (!form.category)     e.category = "Pick a category";
    if (form.offer_type === "sell" && !form.price) e.price = "Enter a price";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setBusy(true);
    try   { await onSubmit(form); onClose(); }
    catch { /* handled upstream */ }
    finally { setBusy(false); }
  };

  if (!open) return null;

  return (
    <div
      className="p2p-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="p2p-modal" role="dialog" aria-modal="true">
        <div className="p2p-modal-head">
          <span className="p2p-modal-title">Post a Trade Offer</span>
          <button className="p2p-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Offer type tabs */}
        <div className="p2p-modal-tabs">
          {OFFER_TYPES.filter((t) => t.key !== "all").map((t) => (
            <button
              key={t.key}
              className={`p2p-modal-tab${form.offer_type === t.key ? " active" : ""}`}
              onClick={() => setForm((f) => ({ ...f, offer_type: t.key }))}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="p2p-modal-body">

          {/* Title */}
          <label className="p2p-field">
            <span>Item title *</span>
            <input
              className={`p2p-input${errors.title ? " err" : ""}`}
              placeholder="e.g. iPhone 13 Pro Max"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            {errors.title && <span className="p2p-err">{errors.title}</span>}
          </label>

          {/* Price */}
          {form.offer_type === "sell" && (
            <label className="p2p-field">
              <span>Price (₦) *</span>
              <input
                className={`p2p-input${errors.price ? " err" : ""}`}
                type="number"
                placeholder="e.g. 150000"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
              {errors.price && <span className="p2p-err">{errors.price}</span>}
            </label>
          )}

          {/* Swap target */}
          {form.offer_type === "swap" && (
            <label className="p2p-field">
              <span>What are you looking for?</span>
              <input
                className="p2p-input"
                placeholder="e.g. Samsung Galaxy S22 or cash top-up"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
          )}

          {/* Category */}
          <label className="p2p-field">
            <span>Category *</span>
            <select
              className={`p2p-select${errors.category ? " err" : ""}`}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              <option value="">Select a category</option>
              {CATEGORY_CONFIG.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
            {errors.category && <span className="p2p-err">{errors.category}</span>}
          </label>

          {/* Description */}
          {form.offer_type !== "swap" && (
            <label className="p2p-field">
              <span>Description</span>
              <textarea
                className="p2p-textarea"
                rows={3}
                placeholder="Condition, extras, reason for selling…"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
          )}
        </div>

        <div className="p2p-modal-foot">
          <button className="p2p-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="p2p-modal-submit" onClick={handleSubmit} disabled={busy}>
            {busy ? "Posting…" : "Post Offer →"}
          </button>
        </div>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MATCH ME BANNER
═══════════════════════════════════════════════════════════════ */
const MatchBanner = memo(({ onMatch }) => (
  <div className="p2p-match-banner">
    <div className="p2p-match-copy">
      <span className="p2p-match-icon">🤝</span>
      <div>
        <div className="p2p-match-title">Find your perfect trade partner</div>
        <div className="p2p-match-sub">
          Tell us what you have & what you want — we'll find matches nearby
        </div>
      </div>
    </div>
    <button className="p2p-match-btn" onClick={onMatch}>Match Me</button>
  </div>
));

/* ═══════════════════════════════════════════════════════════════
   P2P PAGE
═══════════════════════════════════════════════════════════════ */
export default function P2P({ user }) {
  const navigate = useNavigate();

  const [offers,   setOffers]   = useState([]);
  const [promoted, setPromoted] = useState([]);
  const [meta,     setMeta]     = useState({});
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // Filters
  const [offerType,  setOfferType]  = useState("all");
  const [activeSort, setActiveSort] = useState("smart");
  const [visible,    setVisible]    = useState(ITEMS_PER_PAGE);

  // UI
  const [pickerOpen, setPickerOpen] = useState(false);
  const [postOpen,   setPostOpen]   = useState(false);

  const lastLocationRef = useRef(
    JSON.parse(localStorage.getItem("lastLocation") || "null")
  );

  /* ════════════════════════════════════════════════════════════
     LOAD OFFERS
  ════════════════════════════════════════════════════════════ */
  const loadOffers = useCallback(async () => {
    setLoading(true);
    setError(null);

    const fetchData = async (qs = "") => {
      const res = await fetch(`${API}/homepage${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };

    try {
      const data = await new Promise((resolve, reject) => {
        let done = false;
        const finish = (fn) => { if (done) return; done = true; fn(); };

        const timeout = setTimeout(() => {
          finish(() => fetchData().then(resolve).catch(reject));
        }, 5_000);

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              finish(() => {
                clearTimeout(timeout);
                const { latitude, longitude } = pos.coords;
                lastLocationRef.current = { latitude, longitude };
                localStorage.setItem("lastLocation", JSON.stringify({ latitude, longitude }));
                fetchData(`?lat=${latitude}&lng=${longitude}`)
                  .then(resolve)
                  .catch(() => fetchData().then(resolve).catch(reject));
              });
            },
            () => {
              finish(() => { clearTimeout(timeout); fetchData().then(resolve).catch(reject); });
            },
            GPS_OPTIONS
          );
        } else {
          finish(() => { clearTimeout(timeout); fetchData().then(resolve).catch(reject); });
        }
      });

      // ── Collect + normalize all products ──
      const raw = dedup([
        ...(data.products    || []),
        ...(data.recommended || []),
        ...(data.trending    || []),
        ...(data.latest      || []),
      ]);

      const normalized = raw
        .map(normalizeProduct)
        .filter(Boolean);

      setOffers(normalized);
      setPromoted(normalized.filter((p) => p.is_promoted));
      setMeta(data.meta || {});

    } catch (err) {
      console.error("[P2P] load error:", err);
      setError("Could not load trade offers. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Bootstrap ─────────────────────────────────────────────
  useEffect(() => { loadOffers(); }, []); // eslint-disable-line

  // ── 30-min refresh ────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => loadOffers(), REFRESH_MS);
    return () => clearInterval(id);
  }, [loadOffers]);

  // ── Movement-aware refresh ────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    const check = () => {
      navigator.geolocation.getCurrentPosition(
        ({ coords: { latitude, longitude } }) => {
          const prev = lastLocationRef.current;
          if (!prev) { lastLocationRef.current = { latitude, longitude }; return; }
          if (getDistanceKm(prev.latitude, prev.longitude, latitude, longitude) > MOVE_THRESHOLD) {
            lastLocationRef.current = { latitude, longitude };
            localStorage.setItem("lastLocation", JSON.stringify({ latitude, longitude }));
            loadOffers();
          }
        },
        () => {},
        { enableHighAccuracy: false, maximumAge: 300_000, timeout: 5_000 }
      );
    };
    const id = setInterval(check, MOVE_CHECK_MS);
    return () => clearInterval(id);
  }, [loadOffers]);

  // ── Location changed event ────────────────────────────────
  useEffect(() => {
    const h = () => loadOffers();
    window.addEventListener("locationChanged", h);
    return () => window.removeEventListener("locationChanged", h);
  }, [loadOffers]);

  // ── Analytics ─────────────────────────────────────────────
  const handleClick = useCallback((product) => {
    fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    navigate(`/product/${product.slug}`);
  }, [navigate]);

  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  // ── Post offer ────────────────────────────────────────────
  const handlePostOffer = useCallback(async (form) => {
    const res = await fetch(`${API}/products`, {
      method  : "POST",
      headers : { "Content-Type": "application/json" },
      body    : JSON.stringify({ ...form, p2p: true }),
    });
    if (!res.ok) throw new Error("Post failed");
    await loadOffers();
  }, [loadOffers]);

  // ── Derived ───────────────────────────────────────────────
  const activeLoc  = getActiveLocation();
  const locLabel   = useMemo(() => {
    if (activeLoc?.label) return activeLoc.label;
    return heroLocation(meta);
  }, [meta, activeLoc]);

  const cityLabel  = locLabel?.split(",")[0] || "Nigeria";
  const recentCats = useMemo(() => getRecentCategories(), []);

  const filtered = useMemo(() => {
    if (offerType === "all")  return offers;
    if (offerType === "free") return offers.filter(
      (p) => p.offer_type === "free" || p.price === 0
    );
    return offers.filter((p) => p.offer_type === offerType);
  }, [offers, offerType]);

  const sorted = useMemo(
    () => applySort(filtered, activeSort, recentCats),
    [filtered, activeSort, recentCats]
  );

  const withInjections = useMemo(
    () => injectPromoted(sorted.slice(0, visible), promoted),
    [sorted, visible, promoted]
  );

  const typeCounts = useMemo(() => {
    const counts = { all: offers.length, sell: 0, swap: 0, free: 0 };
    offers.forEach((p) => {
      if (p.offer_type === "swap")               counts.swap++;
      else if (p.offer_type === "free" || p.price === 0) counts.free++;
      else                                       counts.sell++;
    });
    return counts;
  }, [offers]);

  const nearbyHighlights = useMemo(
    () => offers.filter((p) => p.distance_km != null).slice(0, 4),
    [offers]
  );

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <>
      <TopNav user={user} />

      <div className="p2p-pg">

        {/* ══════════════════════════════════════════════
            HERO
        ══════════════════════════════════════════════ */}
        <div className="p2p-hero">
          <div className="p2p-hero-top">
            <div>
              <div className="p2p-hero-kicker">Peer-to-Peer</div>
              <div className="p2p-hero-h1">
                Trade directly with <i>real people</i>
              </div>
              <div className="p2p-hero-sub">
                Buy, sell, swap, or give away — no middleman
              </div>
            </div>
            <button
              className="p2p-notify"
              aria-label="Notifications"
              onClick={() => navigate("/notifications")}
            >
              🔔
            </button>
          </div>

          {/* Location pill */}
          <button
            className="p2p-hero-loc"
            onClick={() => setPickerOpen(true)}
            aria-label="Change location"
          >
            <PinIcon size={13} />
            <span>{locLabel || "Set your location"}</span>
            {meta.nearbySource === "gps" && (
              <span className="p2p-gps-chip">GPS</span>
            )}
            <span className="p2p-loc-change">Change</span>
          </button>

          {/* Stats */}
          <div className="p2p-hero-stats">
            <div className="p2p-hero-stat">
              <div className="p2p-stat-n">{loading ? "—" : `${offers.length}+`}</div>
              <div className="p2p-stat-l">Active offers</div>
            </div>
            <div className="p2p-hero-stat">
              <div className="p2p-stat-n">{loading ? "—" : typeCounts.swap}</div>
              <div className="p2p-stat-l">Swap offers</div>
            </div>
            <div className="p2p-hero-stat">
              <div className="p2p-stat-n">{loading ? "—" : typeCounts.free}</div>
              <div className="p2p-stat-l">Free items</div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            SEARCH
        ══════════════════════════════════════════════ */}
        <div className="p2p-search-wrap" onClick={() => navigate("/search?p2p=1")}>
          <div className="p2p-search">
            <span className="p2p-search-ic">🔍</span>
            <span className="p2p-search-txt">Search trade offers…</span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            MATCH ME BANNER
        ══════════════════════════════════════════════ */}
        {!loading && offers.length > 0 && (
          <MatchBanner onMatch={() => navigate("/p2p/match")} />
        )}

        {/* ══════════════════════════════════════════════
            ERROR
        ══════════════════════════════════════════════ */}
        {error && (
          <div className="p2p-err-box">
            <div className="p2p-err-title">Offers unavailable</div>
            <div className="p2p-err-msg">{error}</div>
            <button className="p2p-err-btn" onClick={loadOffers}>Try again</button>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            NEARBY HIGHLIGHTS
        ══════════════════════════════════════════════ */}
        {(loading || nearbyHighlights.length > 0) && (
          <div className="p2p-sec">
            <SectionHead
              title={
                <>
                  <PinIcon size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  Near You
                </>
              }
              sub={locLabel ? `in ${cityLabel}` : undefined}
              chip={meta.nearbySource === "gps" ? "GPS" : undefined}
            />
            {loading ? (
              <SkeletonRow />
            ) : (
              <div className="p2p-row">
                {nearbyHighlights.map((p, i) => (
                  <OfferCard
                    key={p.id}
                    product={p}
                    priority={i === 0}
                    onClick={handleClick}
                    onView={trackView}
                    horizontal
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            ALL OFFERS
        ══════════════════════════════════════════════ */}
        <div className="p2p-sec">
          <SectionHead
            title="All Offers"
            sub={`${filtered.length} listings`}
          />

          {/* Filter chips */}
          <div className="p2p-filter-strip">
            {OFFER_TYPES.map((t) => (
              <button
                key={t.key}
                className={`p2p-filter-chip${offerType === t.key ? " active" : ""}`}
                onClick={() => { setOfferType(t.key); setVisible(ITEMS_PER_PAGE); }}
              >
                {t.icon} {t.label}
                {typeCounts[t.key] > 0 && (
                  <span className="p2p-filter-count">{typeCounts[t.key]}</span>
                )}
              </button>
            ))}
          </div>

          {/* Sort chips */}
          {!loading && filtered.length > 0 && (
            <div className="p2p-sort-strip">
              {SORT_OPTS.map((o) => (
                <button
                  key={o.key}
                  className={`p2p-sort-chip${activeSort === o.key ? " active" : ""}`}
                  onClick={() => { setActiveSort(o.key); setVisible(ITEMS_PER_PAGE); }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <SkeletonGrid />
          ) : filtered.length === 0 ? (
            <div className="p2p-empty">
              <div className="p2p-empty-emoji">🤝</div>
              <div className="p2p-empty-title">
                No {offerType === "all"
                  ? ""
                  : OFFER_TYPES.find((t) => t.key === offerType)?.label}{" "}
                offers yet
              </div>
              <div className="p2p-empty-sub">
                Be the first to post in <strong>{cityLabel}</strong>!
              </div>
              <button className="p2p-empty-btn" onClick={() => setPostOpen(true)}>
                Post an Offer →
              </button>
            </div>
          ) : (
            <>
              <div className="p2p-grid">
                {withInjections.map((p, i) =>
                  p ? (
                    <OfferCard
                      key={`${p.id}-${i}`}
                      product={p}
                      priority={i < 2}
                      onClick={handleClick}
                      onView={trackView}
                    />
                  ) : null
                )}
              </div>

              {visible < sorted.length && (
                <button
                  className="p2p-load-more"
                  onClick={() => setVisible((v) => v + ITEMS_PER_PAGE)}
                >
                  Load more ({sorted.length - visible} remaining)
                </button>
              )}
            </>
          )}
        </div>

        {/* ══════════════════════════════════════════════
            WELCOME (no offers)
        ══════════════════════════════════════════════ */}
        {!loading && offers.length === 0 && !error && (
          <div className="p2p-welcome">
            <div className="p2p-welcome-icon">🔄</div>
            <div className="p2p-welcome-title">The P2P marketplace is open</div>
            <div className="p2p-welcome-sub">
              Post your first offer and start trading directly with
              neighbours in {cityLabel}.
            </div>
            <button className="p2p-welcome-btn" onClick={() => setPostOpen(true)}>
              Post Your First Offer
            </button>
          </div>
        )}

      </div>

      {/* ── FAB ── */}
      <button
        className="p2p-fab"
        onClick={() => setPostOpen(true)}
        aria-label="Post a trade offer"
      >
        <span className="p2p-fab-ic">🔄</span>
        Trade Now
      </button>

      {/* ── Modals ── */}
      <PostOfferModal
        open={postOpen}
        onClose={() => setPostOpen(false)}
        onSubmit={handlePostOffer}
      />

      <LocationPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={() => { setPickerOpen(false); loadOffers(); }}
      />

      <Footer />
      <BottomNav />

      {/* ── Inject styles ── */}
      <style>{P2P_STYLES}</style>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════ */
const P2P_STYLES = `
/* ── Page ── */
.p2p-pg {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 0 120px;
  font-family: 'DM Sans', system-ui, sans-serif;
}

/* ── Hero ── */
.p2p-hero {
  background: linear-gradient(145deg, #0a0f1e 0%, #10193a 60%, #1a2a52 100%);
  border-radius: 0 0 28px 28px;
  padding: 24px 20px 28px;
  color: #fff;
  position: relative;
  overflow: hidden;
}
.p2p-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 80% 20%, rgba(100,180,255,.08), transparent 60%);
  pointer-events: none;
}
.p2p-hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}
.p2p-hero-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: #64b4ff;
  margin-bottom: 6px;
}
.p2p-hero-h1 {
  font-size: 26px;
  font-weight: 800;
  line-height: 1.2;
  margin: 0 0 6px;
}
.p2p-hero-h1 i { font-style: italic; color: #64b4ff; }
.p2p-hero-sub  { font-size: 13px; color: rgba(255,255,255,.6); }

.p2p-notify {
  background: rgba(255,255,255,.08);
  border: none;
  border-radius: 50%;
  width: 38px; height: 38px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; cursor: pointer; flex-shrink: 0;
}

/* ── Location pill ── */
.p2p-hero-loc {
  display: inline-flex; align-items: center; gap: 5px;
  background: rgba(255,255,255,.1);
  border: 1px solid rgba(255,255,255,.15);
  border-radius: 20px;
  padding: 5px 12px;
  font-size: 12px; color: #e0eeff;
  cursor: pointer; margin-bottom: 18px;
}
.p2p-gps-chip {
  background: #64b4ff; color: #0a0f1e;
  font-size: 9px; font-weight: 700;
  padding: 1px 5px; border-radius: 6px; margin-left: 2px;
}
.p2p-loc-change { color: #64b4ff; font-size: 11px; }

/* ── Hero stats ── */
.p2p-hero-stats {
  display: flex; gap: 0;
  background: rgba(255,255,255,.06);
  border-radius: 14px; overflow: hidden;
}
.p2p-hero-stat {
  flex: 1; text-align: center; padding: 12px 8px;
  border-right: 1px solid rgba(255,255,255,.07);
}
.p2p-hero-stat:last-child { border-right: none; }
.p2p-stat-n { font-size: 20px; font-weight: 800; }
.p2p-stat-l { font-size: 10px; color: rgba(255,255,255,.5); margin-top: 2px; }

/* ── Search ── */
.p2p-search-wrap { padding: 14px 16px 0; cursor: pointer; }
.p2p-search {
  display: flex; align-items: center; gap: 10px;
  background: #f4f2ef;
  border-radius: 12px; padding: 12px 16px;
}
.p2p-search-ic  { font-size: 16px; }
.p2p-search-txt { color: #a09890; font-size: 14px; flex: 1; }

/* ── Match Banner ── */
.p2p-match-banner {
  margin: 14px 16px 0;
  background: linear-gradient(120deg, #fff7eb 0%, #ffecd6 100%);
  border: 1px solid #ffd9a8;
  border-radius: 16px;
  padding: 16px;
  display: flex; align-items: center; gap: 12px;
  justify-content: space-between;
}
.p2p-match-copy  { display: flex; align-items: center; gap: 12px; }
.p2p-match-icon  { font-size: 28px; }
.p2p-match-title { font-size: 14px; font-weight: 700; color: #1a1208; }
.p2p-match-sub   { font-size: 11px; color: #7a5e38; margin-top: 2px; }
.p2p-match-btn {
  background: #e8630a; color: #fff; border: none;
  border-radius: 10px; padding: 10px 16px;
  font-size: 13px; font-weight: 700; cursor: pointer;
  white-space: nowrap; flex-shrink: 0;
  transition: opacity .15s;
}
.p2p-match-btn:hover { opacity: .88; }

/* ── Error ── */
.p2p-err-box {
  margin: 14px 16px 0;
  background: #fff5f5; border: 1px solid #ffd5d5;
  border-radius: 14px; padding: 20px; text-align: center;
}
.p2p-err-title { font-weight: 700; color: #c0392b; margin-bottom: 6px; }
.p2p-err-msg   { font-size: 13px; color: #7a3b3b; margin-bottom: 12px; }
.p2p-err-btn {
  background: #c0392b; color: #fff; border: none;
  border-radius: 8px; padding: 8px 18px;
  font-size: 13px; cursor: pointer;
}

/* ── Section ── */
.p2p-sec { padding: 20px 16px 0; }
.p2p-sec-head {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 12px;
}
.p2p-sec-label { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.p2p-sec-title { font-size: 17px; font-weight: 800; color: #1a1614; }
.p2p-sec-chip  {
  background: #e8630a; color: #fff;
  font-size: 10px; font-weight: 700;
  padding: 2px 8px; border-radius: 20px;
}
.p2p-sec-sub { font-size: 12px; color: #a09890; }
.p2p-see-all {
  background: none; border: none; cursor: pointer;
  color: #e8630a; font-size: 13px; font-weight: 600;
}

/* ── Horizontal row ── */
.p2p-row {
  display: flex; gap: 12px; overflow-x: auto;
  padding-bottom: 8px;
  scrollbar-width: none;
}
.p2p-row::-webkit-scrollbar { display: none; }

/* ── Masonry grid ── */
.p2p-grid { columns: 2; column-gap: 10px; }
@media (min-width: 600px) { .p2p-grid { columns: 3; } }
@media (min-width: 860px) { .p2p-grid { columns: 4; } }

/* ═══════════════════════════════════════════════
   OFFER CARD — the main fix
═══════════════════════════════════════════════ */
.p2p-card {
  break-inside: avoid;
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid #ede9e4;
  margin-bottom: 10px;
  cursor: pointer;
  transition: transform .15s ease, box-shadow .15s ease;
}
.p2p-card:hover   { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.08); }
.p2p-card:active  { transform: scale(.97); }
.p2p-card--promo  { border-color: #ffd9a8; }

/* Horizontal variant (nearby row) */
.p2p-card--h {
  break-inside: unset;
  min-width: 160px;
  max-width: 175px;
  flex-shrink: 0;
  margin-bottom: 0;
}

/* Image */
.p2p-card-img-wrap { position: relative; }
.p2p-card-img {
  width: 100%; display: block;
  object-fit: cover; aspect-ratio: 4/3;
  background: #f0ece6;
  transition: transform .3s;
}
.p2p-card:hover .p2p-card-img { transform: scale(1.03); }

/* Badges */
.p2p-badge {
  position: absolute; top: 8px; left: 8px;
  font-size: 9px; font-weight: 800; letter-spacing: .04em;
  padding: 3px 7px; border-radius: 6px;
}
.badge--free      { background: #16a34a; color: #fff; }
.badge--swap      { background: #2563eb; color: #fff; }
.p2p-badge--ad    { top: 8px; left: auto; right: 8px; background: rgba(0,0,0,.5); color: #fff; }
.p2p-badge--promo { background: #e8630a; color: #fff; }

/* Body */
.p2p-card-body { padding: 10px 10px 10px; }

.p2p-card-title {
  font-size: 13px; font-weight: 600; color: #1a1614;
  line-height: 1.35; margin-bottom: 5px;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}

.p2p-card-price { margin-bottom: 8px; }
.p2p-price-val  { font-size: 15px; font-weight: 800; color: #1a1614; }
.p2p-price-free { font-size: 14px; font-weight: 800; color: #16a34a; }
.p2p-price-swap { font-size: 12px; font-weight: 700; color: #2563eb; }

/* ── Seller row with online dot ── */
.p2p-card-seller {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 6px;
}

/* Avatar wrapper — needed for dot positioning */
.p2p-avatar-wrap {
  position: relative;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
}

.p2p-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0;
}

/* ✅ Online green dot */
.p2p-online-dot {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 8px;
  height: 8px;
  background: #22c55e;
  border-radius: 50%;
  border: 1.5px solid #fff;
  box-shadow: 0 0 0 1px rgba(34,197,94,.3);
}

.p2p-seller-name {
  font-size: 11px;
  color: #5a5248;
  font-weight: 500;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Location row */
.p2p-card-loc-row {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.p2p-dist {
  font-size: 10px;
  color: #e8630a;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 2px;
}
.p2p-city { font-size: 10px; color: #a09890; }

/* Footer */
.p2p-card-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.p2p-time  { font-size: 10px; color: #c0b8b2; }
.p2p-views { font-size: 10px; color: #c0b8b2; }

/* ── Skeleton ── */
.p2p-sk {
  background: linear-gradient(90deg, #f0ece6 25%, #e8e4de 50%, #f0ece6 75%);
  background-size: 200% 100%;
  animation: p2p-shimmer 1.4s infinite;
  border-radius: 14px;
  margin-bottom: 10px;
}
.p2p-sk--row { min-width: 160px; height: 220px; flex-shrink: 0; margin-bottom: 0; }
@keyframes p2p-shimmer { to { background-position: -200% 0; } }

/* ── Filter & sort strips ── */
.p2p-filter-strip,
.p2p-sort-strip {
  display: flex; gap: 8px; overflow-x: auto;
  padding-bottom: 4px; margin-bottom: 12px;
  scrollbar-width: none;
}
.p2p-filter-strip::-webkit-scrollbar,
.p2p-sort-strip::-webkit-scrollbar { display: none; }

.p2p-filter-chip {
  display: flex; align-items: center; gap: 5px;
  background: #f4f2ef; border: 1px solid #e8e4de;
  border-radius: 20px; padding: 7px 14px;
  font-size: 13px; font-weight: 500; cursor: pointer;
  white-space: nowrap; transition: all .15s;
}
.p2p-filter-chip.active {
  background: #1a1614; border-color: #1a1614; color: #fff;
}
.p2p-filter-count {
  background: #e8630a; color: #fff;
  font-size: 9px; font-weight: 800;
  padding: 1px 5px; border-radius: 20px;
}
.p2p-filter-chip.active .p2p-filter-count {
  background: rgba(255,255,255,.25);
}

.p2p-sort-chip {
  background: none; border: 1px solid #e8e4de;
  border-radius: 16px; padding: 5px 12px;
  font-size: 12px; cursor: pointer;
  white-space: nowrap; transition: all .15s;
}
.p2p-sort-chip.active { background: #e8630a; border-color: #e8630a; color: #fff; }

/* ── Empty ── */
.p2p-empty { text-align: center; padding: 48px 20px; }
.p2p-empty-emoji { font-size: 40px; margin-bottom: 12px; }
.p2p-empty-title { font-size: 17px; font-weight: 700; color: #1a1614; margin-bottom: 6px; }
.p2p-empty-sub   { font-size: 13px; color: #a09890; margin-bottom: 18px; }
.p2p-empty-btn {
  background: #e8630a; color: #fff; border: none;
  border-radius: 12px; padding: 12px 24px;
  font-size: 14px; font-weight: 700; cursor: pointer;
}

/* ── Welcome ── */
.p2p-welcome {
  margin: 20px 16px;
  background: linear-gradient(135deg, #f0f7ff, #e8f0ff);
  border-radius: 20px; padding: 32px 24px; text-align: center;
}
.p2p-welcome-icon  { font-size: 48px; margin-bottom: 16px; }
.p2p-welcome-title { font-size: 20px; font-weight: 800; margin-bottom: 8px; }
.p2p-welcome-sub   { font-size: 14px; color: #5a7090; margin-bottom: 20px; line-height: 1.5; }
.p2p-welcome-btn {
  background: #0a0f1e; color: #fff; border: none;
  border-radius: 14px; padding: 14px 28px;
  font-size: 15px; font-weight: 700; cursor: pointer;
}

/* ── Load more ── */
.p2p-load-more {
  display: block; width: 100%; margin: 16px 0;
  background: #f4f2ef; border: 1px solid #e8e4de;
  border-radius: 12px; padding: 13px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background .15s;
}
.p2p-load-more:hover { background: #ede9e3; }

/* ── FAB ── */
.p2p-fab {
  position: fixed; bottom: 80px; right: 20px; z-index: 100;
  background: #e8630a; color: #fff; border: none;
  border-radius: 24px; padding: 14px 20px;
  font-size: 14px; font-weight: 800; cursor: pointer;
  display: flex; align-items: center; gap: 8px;
  box-shadow: 0 4px 20px rgba(232,99,10,.4);
  transition: transform .15s;
}
.p2p-fab:hover { transform: scale(1.04); }
.p2p-fab-ic    { font-size: 18px; }

/* ── Post offer modal ── */
.p2p-modal-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,.5);
  display: flex; align-items: flex-end; justify-content: center;
}
@media (min-width: 600px) {
  .p2p-modal-overlay { align-items: center; padding: 20px; }
}
.p2p-modal {
  background: #fff;
  border-radius: 24px 24px 0 0;
  width: 100%; max-width: 560px;
  max-height: 90vh; overflow-y: auto;
  display: flex; flex-direction: column;
}
@media (min-width: 600px) { .p2p-modal { border-radius: 24px; } }

.p2p-modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 20px 0;
}
.p2p-modal-title { font-size: 18px; font-weight: 800; }
.p2p-modal-close {
  background: #f4f2ef; border: none;
  width: 32px; height: 32px; border-radius: 50%;
  font-size: 13px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.p2p-modal-tabs {
  display: flex; gap: 8px; padding: 16px 20px;
  overflow-x: auto; scrollbar-width: none;
}
.p2p-modal-tab {
  flex-shrink: 0;
  background: #f4f2ef; border: 1px solid #e8e4de;
  border-radius: 20px; padding: 7px 14px;
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all .15s;
}
.p2p-modal-tab.active { background: #1a1614; border-color: #1a1614; color: #fff; }

.p2p-modal-body { padding: 0 20px; flex: 1; }
.p2p-field  { display: flex; flex-direction: column; gap: 5px; margin-bottom: 16px; }
.p2p-field span { font-size: 13px; font-weight: 600; color: #3a3028; }

.p2p-input,
.p2p-select,
.p2p-textarea {
  background: #f8f6f3;
  border: 1.5px solid #e8e4de;
  border-radius: 10px; padding: 11px 14px;
  font-size: 14px; outline: none;
  transition: border-color .15s;
  font-family: inherit;
}
.p2p-input:focus,
.p2p-select:focus,
.p2p-textarea:focus { border-color: #e8630a; background: #fff; }
.p2p-input.err,
.p2p-select.err { border-color: #ef4444; }
.p2p-textarea { resize: vertical; }
.p2p-err { font-size: 11px; color: #ef4444; }

.p2p-modal-foot { display: flex; gap: 10px; padding: 16px 20px 28px; }
.p2p-modal-cancel {
  flex: 1; background: #f4f2ef; border: none;
  border-radius: 12px; padding: 13px;
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.p2p-modal-submit {
  flex: 2; background: #e8630a; color: #fff; border: none;
  border-radius: 12px; padding: 13px;
  font-size: 14px; font-weight: 700; cursor: pointer;
  transition: opacity .15s;
}
.p2p-modal-submit:disabled { opacity: .5; cursor: not-allowed; }

/* ── Responsive ── */
@media (max-width: 380px) {
  .p2p-hero-h1 { font-size: 22px; }
  .p2p-grid    { columns: 2; }
}
`;