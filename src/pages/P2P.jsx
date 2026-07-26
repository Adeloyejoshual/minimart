/**
 * src/pages/P2P.jsx
 * Route: /p2p
 */

import {
  useEffect, useState, useCallback, useRef, memo, useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import TopNav          from "../components/TopNav";
import BottomNav       from "../components/BottomNav";
import Footer          from "../components/Footer";
import LocationPicker  from "../components/LocationPicker";
import { getActiveLocation } from "../hooks/useLocation";
import CATEGORY_CONFIG from "../config/categories";
import "../styles/p2p.css";

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
const NOTIF_POLL_MS  = 60_000;

const GPS_OPTIONS = {
  timeout            : 5_000,
  enableHighAccuracy : false,
  maximumAge         : 300_000,
};

const SORT_OPTS = [
  { key: "smart",      label: "Best Match" },
  { key: "newest",     label: "Newest"     },
  { key: "price_asc",  label: "Price ↑"   },
  { key: "price_desc", label: "Price ↓"   },
];

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE PRODUCT
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

    image:
      p.image ||
      (Array.isArray(p.images) && p.images.length > 0
        ? typeof p.images[0] === "string"
          ? p.images[0]
          : p.images[0]?.url || null
        : null) ||
      p.main_image    ||
      p.thumbnail_url ||
      null,

    location_city : p.location?.city  || p.location_city  || null,
    location_state: p.location?.state || p.location_state || null,
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
  let s = 0;
  s += p.engagement_score    || 0;
  s += p.is_promoted ? 50    : 0;
  s += (p.promotion_priority || 0) * 5;
  s += (p.ctr                || 0) * 30;
  if (p.category_id && recentCats.includes(p.category_id)) s += 20;
  return s;
};

const applySort = (arr, key, recentCats) => {
  if (key === "newest")
    return [...arr].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  if (key === "price_asc")
    return [...arr].sort((a, b) => (a.price || 0) - (b.price || 0));
  if (key === "price_desc")
    return [...arr].sort((a, b) => (b.price || 0) - (a.price || 0));
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
  <svg
    width={size} height={size}
    viewBox="0 0 24 24" fill="currentColor"
    aria-hidden="true" style={{ flexShrink: 0 }}
  >
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75
      7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5
      2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════════ */
const SkeletonGrid = () => (
  <div className="p2p-grid">
    {[...Array(8)].map((_, i) => (
      <div
        key={i}
        className="p2p-sk"
        style={{ height: `${200 + (i % 3) * 60}px` }}
      />
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
   OFFER CARD
═══════════════════════════════════════════════════════════════ */
const OfferCard = memo(function OfferCard({
  product, onClick, onView, priority = false, horizontal = false,
}) {
  const cardRef = useRef(null);

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
    ? product.distance_km < 1 ? "<1 km" : `${Math.round(product.distance_km)} km`
    : null;

  return (
    <div
      ref={cardRef}
      className={[
        "p2p-card",
        product._injected ? "p2p-card--promo" : "",
        horizontal        ? "p2p-card--h"     : "",
      ].filter(Boolean).join(" ")}
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(product); }}
    >
      {/* Image */}
      <div className="p2p-card-img-wrap">
        <img
          className="p2p-card-img"
          src={imageUrl}
          alt={product.title || "Product"}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={(e) => { e.currentTarget.src = PH; }}
        />
        {badge.label && (
          <span className={`p2p-badge ${badge.cls}`}>{badge.label}</span>
        )}
        {product._injected && (
          <span className="p2p-badge p2p-badge--ad">Ad</span>
        )}
        {product.is_promoted && !product._injected && (
          <span className="p2p-badge p2p-badge--promo">⚡ Featured</span>
        )}
      </div>

      {/* Body */}
      <div className="p2p-card-body">
        <p className="p2p-card-title">{product.title || "Untitled"}</p>

        <div className="p2p-card-price">
          {product.offer_type === "free" || product.price === 0
            ? <span className="p2p-price-free">Free</span>
            : product.offer_type === "swap"
              ? <span className="p2p-price-swap">Open to offers</span>
              : <span className="p2p-price-val">{naira(product.price)}</span>
          }
        </div>

        {/* Seller */}
        <div className="p2p-card-seller">
          <div className="p2p-avatar-wrap">
            <div
              className="p2p-avatar"
              style={{
                background: `hsl(${sellerName.charCodeAt(0) * 7 % 360},55%,50%)`,
              }}
            >
              {initials}
            </div>
            {isOnline && <span className="p2p-online-dot" />}
          </div>
          <span className="p2p-seller-name">{sellerName}</span>
        </div>

        {/* Location */}
        <div className="p2p-card-loc-row">
          {dist && (
            <span className="p2p-dist">
              <PinIcon size={10} /> {dist}
            </span>
          )}
          {locCity && <span className="p2p-city">{locCity}</span>}
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
  const [form, setForm] = useState({
    title      : "",
    price      : "",
    category   : "",
    offer_type : "sell",
    description: "",
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
            {errors.title && <span className="p2p-err-msg">{errors.title}</span>}
          </label>

          {/* Offer type select */}
          <label className="p2p-field">
            <span>Offer type</span>
            <select
              className="p2p-select"
              value={form.offer_type}
              onChange={(e) => setForm((f) => ({ ...f, offer_type: e.target.value }))}
            >
              <option value="sell">💰 For Sale</option>
              <option value="swap">🔄 Swap / Trade</option>
              <option value="free">🎁 Free</option>
            </select>
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
              {errors.price && <span className="p2p-err-msg">{errors.price}</span>}
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
            {errors.category && <span className="p2p-err-msg">{errors.category}</span>}
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
          <button
            className="p2p-modal-submit"
            onClick={handleSubmit}
            disabled={busy}
          >
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
          Tell us what you have &amp; what you want — we'll find matches nearby
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

  const [activeSort, setActiveSort] = useState("smart");
  const [visible,    setVisible]    = useState(ITEMS_PER_PAGE);

  const [pickerOpen,   setPickerOpen]   = useState(false);
  const [postOpen,     setPostOpen]     = useState(false);
  const [unreadCount,  setUnreadCount]  = useState(0);

  const lastLocationRef = useRef(
    JSON.parse(localStorage.getItem("lastLocation") || "null")
  );

  /* ════════════════════════════════════════════════════════════
     NOTIFICATION BADGE — poll unread count
  ════════════════════════════════════════════════════════════ */
  const fetchUnreadCount = useCallback(async () => {
    if (!user) { setUnreadCount(0); return; }
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${API}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setUnreadCount(data.count ?? 0);
    } catch {
      /* silent — badge is non-critical */
    }
  }, [user]);

  /* ── Poll on mount + interval ────────────────────────── */
  useEffect(() => {
    fetchUnreadCount();
    if (!user) return;
    const id = setInterval(fetchUnreadCount, NOTIF_POLL_MS);
    return () => clearInterval(id);
  }, [fetchUnreadCount, user]);

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
            ({ coords: { latitude, longitude } }) => {
              finish(() => {
                clearTimeout(timeout);
                lastLocationRef.current = { latitude, longitude };
                localStorage.setItem(
                  "lastLocation",
                  JSON.stringify({ latitude, longitude })
                );
                fetchData(`?lat=${latitude}&lng=${longitude}`)
                  .then(resolve)
                  .catch(() => fetchData().then(resolve).catch(reject));
              });
            },
            () => {
              finish(() => {
                clearTimeout(timeout);
                fetchData().then(resolve).catch(reject);
              });
            },
            GPS_OPTIONS
          );
        } else {
          finish(() => {
            clearTimeout(timeout);
            fetchData().then(resolve).catch(reject);
          });
        }
      });

      const raw = dedup([
        ...(data.products    || []),
        ...(data.recommended || []),
        ...(data.trending    || []),
        ...(data.latest      || []),
      ]);

      const normalized = raw.map(normalizeProduct).filter(Boolean);

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

  /* ── Bootstrap ─────────────────────────────────────────── */
  useEffect(() => { loadOffers(); }, []); // eslint-disable-line

  /* ── 30-min refresh ──────────────────────────────────────*/
  useEffect(() => {
    const id = setInterval(loadOffers, REFRESH_MS);
    return () => clearInterval(id);
  }, [loadOffers]);

  /* ── Movement-aware refresh ─────────────────────────────*/
  useEffect(() => {
    if (!navigator.geolocation) return;
    const check = () => {
      navigator.geolocation.getCurrentPosition(
        ({ coords: { latitude, longitude } }) => {
          const prev = lastLocationRef.current;
          if (!prev) { lastLocationRef.current = { latitude, longitude }; return; }
          if (
            getDistanceKm(prev.latitude, prev.longitude, latitude, longitude) >
            MOVE_THRESHOLD
          ) {
            lastLocationRef.current = { latitude, longitude };
            localStorage.setItem(
              "lastLocation",
              JSON.stringify({ latitude, longitude })
            );
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

  /* ── Location changed event ─────────────────────────────*/
  useEffect(() => {
    const h = () => loadOffers();
    window.addEventListener("locationChanged", h);
    return () => window.removeEventListener("locationChanged", h);
  }, [loadOffers]);

  /* ── Analytics ──────────────────────────────────────────*/
  const handleClick = useCallback((product) => {
    fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    navigate(`/product/${product.slug}`);
  }, [navigate]);

  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  /* ── Post offer ─────────────────────────────────────────*/
  const handlePostOffer = useCallback(async (form) => {
    const res = await fetch(`${API}/products`, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ ...form, p2p: true }),
    });
    if (!res.ok) throw new Error("Post failed");
    await loadOffers();
  }, [loadOffers]);

  /* ── Derived ────────────────────────────────────────────*/
  const activeLoc = getActiveLocation();
  const locLabel  = useMemo(() => {
    if (activeLoc?.label) return activeLoc.label;
    return heroLocation(meta);
  }, [meta, activeLoc]);

  const cityLabel  = locLabel?.split(",")[0] || "Nigeria";
  const recentCats = useMemo(() => getRecentCategories(), []);

  const sorted = useMemo(
    () => applySort(offers, activeSort, recentCats),
    [offers, activeSort, recentCats]
  );

  const withInjections = useMemo(
    () => injectPromoted(sorted.slice(0, visible), promoted),
    [sorted, visible, promoted]
  );

  const nearbyHighlights = useMemo(
    () => offers.filter((p) => p.distance_km != null).slice(0, 6),
    [offers]
  );

  const swapCount = useMemo(
    () => offers.filter((p) => p.offer_type === "swap").length,
    [offers]
  );

  const freeCount = useMemo(
    () => offers.filter((p) => p.offer_type === "free" || p.price === 0).length,
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
              {unreadCount > 0 && (
                <span className="p2p-notify-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
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
              <div className="p2p-stat-n">{loading ? "—" : swapCount}</div>
              <div className="p2p-stat-l">Swap offers</div>
            </div>
            <div className="p2p-hero-stat">
              <div className="p2p-stat-n">{loading ? "—" : freeCount}</div>
              <div className="p2p-stat-l">Free items</div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            SEARCH
        ══════════════════════════════════════════════ */}
        <div
          className="p2p-search-wrap"
          onClick={() => navigate("/search?p2p=1")}
        >
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
            <div className="p2p-err-box-title">Offers unavailable</div>
            <div className="p2p-err-box-msg">{error}</div>
            <button className="p2p-err-box-btn" onClick={loadOffers}>
              Try again
            </button>
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
                  <PinIcon
                    size={13}
                    style={{ verticalAlign: "middle", marginRight: 4 }}
                  />
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
            sub={`${offers.length} listings`}
          />

          {/* Sort chips */}
          {!loading && offers.length > 0 && (
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
          ) : offers.length === 0 ? (
            <div className="p2p-empty">
              <div className="p2p-empty-emoji">🤝</div>
              <div className="p2p-empty-title">No offers yet</div>
              <div className="p2p-empty-sub">
                Be the first to post in <strong>{cityLabel}</strong>!
              </div>
              <button
                className="p2p-empty-btn"
                onClick={() => setPostOpen(true)}
              >
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
            WELCOME (empty state)
        ══════════════════════════════════════════════ */}
        {!loading && offers.length === 0 && !error && (
          <div className="p2p-welcome">
            <div className="p2p-welcome-icon">🔄</div>
            <div className="p2p-welcome-title">
              The P2P marketplace is open
            </div>
            <div className="p2p-welcome-sub">
              Post your first offer and start trading directly with
              neighbours in {cityLabel}.
            </div>
            <button
              className="p2p-welcome-btn"
              onClick={() => setPostOpen(true)}
            >
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
        +
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
    </>
  );
}