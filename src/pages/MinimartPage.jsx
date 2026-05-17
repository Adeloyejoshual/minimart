import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FiSearch,
  FiFilter,
  FiGrid,
  FiList,
  FiChevronDown,
  FiMapPin,
  FiHeart,
  FiStar,
  FiTag,
  FiX,
  FiSliders,
  FiPlus,
} from "react-icons/fi";
import PostAds from "./PostAds";

const API = "https://minimart-ivrm.onrender.com/api";

/* ── helpers ── */
const CATEGORIES = [
  { label: "All", value: "" },
  { label: "Electronics", value: "electronics" },
  { label: "Fashion", value: "fashion" },
  { label: "Food", value: "food" },
  { label: "Home", value: "home" },
  { label: "Beauty", value: "beauty" },
  { label: "Sports", value: "sports" },
  { label: "Books", value: "books" },
  { label: "Toys", value: "toys" },
];

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Price: Low → High", value: "price_asc" },
  { label: "Price: High → Low", value: "price_desc" },
  { label: "Most Popular", value: "popular" },
];

function PriceTag({ price, original }) {
  const hasDiscount = original && original > price;
  const pct = hasDiscount ? Math.round((1 - price / original) * 100) : 0;
  return (
    <div className="mm-price-row">
      <span className="mm-price">₦{Number(price).toLocaleString()}</span>
      {hasDiscount && (
        <>
          <span className="mm-original">₦{Number(original).toLocaleString()}</span>
          <span className="mm-badge">-{pct}%</span>
        </>
      )}
    </div>
  );
}

function ProductCard({ product, user }) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [imgErr, setImgErr] = useState(false);

  return (
    <div
      className="mm-card"
      onClick={() => navigate(`/product/${product.slug}`)}
    >
      <div className="mm-card-img-wrap">
        {!imgErr && product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="mm-card-img"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="mm-card-img-placeholder">
            <FiTag size={32} />
          </div>
        )}

        {product.condition && (
          <span className={`mm-condition mm-condition--${product.condition}`}>
            {product.condition}
          </span>
        )}

        <button
          className={`mm-wishlist ${liked ? "mm-wishlist--active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setLiked((p) => !p);
          }}
        >
          <FiHeart size={15} fill={liked ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="mm-card-body">
        <p className="mm-card-name">{product.name}</p>

        {product.location && (
          <div className="mm-card-loc">
            <FiMapPin size={11} />
            <span>{product.location}</span>
          </div>
        )}

        <PriceTag price={product.price} original={product.originalPrice} />

        {product.seller?.rating > 0 && (
          <div className="mm-card-rating">
            <FiStar size={11} fill="currentColor" />
            <span>{Number(product.seller.rating).toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="mm-card mm-card--skeleton">
      <div className="mm-skel mm-skel-img" />
      <div className="mm-card-body">
        <div className="mm-skel mm-skel-line" style={{ width: "80%" }} />
        <div className="mm-skel mm-skel-line" style={{ width: "50%" }} />
        <div className="mm-skel mm-skel-line" style={{ width: "65%" }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════ MAIN PAGE ═══ */
export default function MinimartPage({ user }) {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPostAds, setShowPostAds] = useState(false);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // grid | list
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filter state
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [condition, setCondition] = useState("");

  const loaderRef = useRef(null);
  const sortRef = useRef(null);

  /* ── debounce search ── */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  /* ── reset page on filter change ── */
  useEffect(() => {
    setPage(1);
    setProducts([]);
    setHasMore(true);
  }, [category, sort, debouncedSearch, minPrice, maxPrice, condition]);

  /* ── fetch ── */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = {
      page,
      limit: 20,
      ...(category && { category }),
      ...(sort && { sort }),
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(minPrice && { minPrice }),
      ...(maxPrice && { maxPrice }),
      ...(condition && { condition }),
    };

    axios
      .get(`${API}/products`, { params })
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        const incoming = Array.isArray(data.products)
          ? data.products
          : Array.isArray(data)
          ? data
          : [];

        setProducts((prev) => (page === 1 ? incoming : [...prev, ...incoming]));
        setTotalCount(data.total ?? incoming.length);
        setHasMore(incoming.length === 20);
      })
      .catch((err) => {
        if (!cancelled) setError("Could not load products. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, category, sort, debouncedSearch, minPrice, maxPrice, condition]);

  /* ── infinite scroll ── */
  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((p) => p + 1);
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading]);

  /* ── close sort dropdown on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const clearFilters = () => {
    setCategory("");
    setSort("newest");
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setCondition("");
  };

  const activeFiltersCount = [
    category,
    minPrice,
    maxPrice,
    condition,
  ].filter(Boolean).length;

  return (
    <>
      <style>{`
        /* ── reset / base ─────────────────────────────── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .mm-page {
          min-height: 100vh;
          background: #f5f4f0;
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          color: #1a1a1a;
        }

        /* ── top bar ────────────────────────────────── */
        .mm-topbar {
          position: sticky;
          top: 0;
          z-index: 100;
          background: #fff;
          border-bottom: 1px solid #e8e6e0;
          padding: 12px 16px 0;
        }

        .mm-topbar-row1 {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .mm-logo-pill {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: #ff5722;
          background: #fff4f0;
          border-radius: 999px;
          padding: 6px 14px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .mm-search-wrap {
          flex: 1;
          position: relative;
        }
        .mm-search-wrap svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #999;
          pointer-events: none;
        }
        .mm-search-input {
          width: 100%;
          height: 40px;
          border: 1.5px solid #e8e6e0;
          border-radius: 10px;
          padding: 0 14px 0 38px;
          font-size: 14px;
          background: #fafaf8;
          outline: none;
          transition: border-color 0.15s;
        }
        .mm-search-input:focus {
          border-color: #ff5722;
          background: #fff;
        }
        .mm-search-clear {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #aaa;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 2px;
        }

        .mm-filter-btn {
          position: relative;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 14px;
          height: 40px;
          border-radius: 10px;
          border: 1.5px solid #e8e6e0;
          background: #fafaf8;
          font-size: 13px;
          font-weight: 600;
          color: #333;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .mm-filter-btn:hover, .mm-filter-btn--active {
          border-color: #ff5722;
          color: #ff5722;
          background: #fff4f0;
        }
        .mm-filter-dot {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 18px;
          height: 18px;
          background: #ff5722;
          color: #fff;
          border-radius: 50%;
          font-size: 10px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* ── category tabs ──────────────────────────── */
        .mm-cats {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 12px;
        }
        .mm-cats::-webkit-scrollbar { display: none; }
        .mm-cat-btn {
          flex-shrink: 0;
          height: 32px;
          padding: 0 14px;
          border-radius: 999px;
          border: 1.5px solid #e8e6e0;
          background: #fafaf8;
          font-size: 13px;
          font-weight: 500;
          color: #555;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .mm-cat-btn:hover { border-color: #ff5722; color: #ff5722; }
        .mm-cat-btn--active {
          background: #ff5722;
          border-color: #ff5722;
          color: #fff;
          font-weight: 700;
        }

        /* ── sub-bar (count + sort + view) ─────────── */
        .mm-subbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
        }

        .mm-count {
          font-size: 13px;
          color: #888;
        }
        .mm-count strong { color: #1a1a1a; font-weight: 700; }

        .mm-subbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* sort dropdown */
        .mm-sort-wrap { position: relative; }
        .mm-sort-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 12px;
          height: 34px;
          border-radius: 8px;
          border: 1.5px solid #e8e6e0;
          background: #fff;
          font-size: 13px;
          font-weight: 500;
          color: #333;
          cursor: pointer;
          transition: border-color 0.15s;
          white-space: nowrap;
        }
        .mm-sort-btn:hover { border-color: #ff5722; }
        .mm-sort-menu {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          background: #fff;
          border: 1.5px solid #e8e6e0;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,.1);
          min-width: 180px;
          z-index: 200;
          overflow: hidden;
          animation: mm-pop .15s ease;
        }
        @keyframes mm-pop {
          from { opacity: 0; transform: translateY(-6px) scale(.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .mm-sort-item {
          padding: 10px 16px;
          font-size: 13px;
          cursor: pointer;
          transition: background .1s;
        }
        .mm-sort-item:hover { background: #f5f4f0; }
        .mm-sort-item--active {
          color: #ff5722;
          font-weight: 600;
          background: #fff4f0;
        }

        /* view toggles */
        .mm-view-toggle {
          display: flex;
          border: 1.5px solid #e8e6e0;
          border-radius: 8px;
          overflow: hidden;
          background: #fff;
        }
        .mm-view-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border: none;
          background: none;
          color: #aaa;
          cursor: pointer;
          transition: all .15s;
        }
        .mm-view-btn--active {
          background: #ff5722;
          color: #fff;
        }

        /* ── product grid / list ────────────────────── */
        .mm-grid {
          display: grid;
          padding: 0 12px 24px;
          gap: 12px;
        }
        .mm-grid--grid { grid-template-columns: repeat(2, 1fr); }
        .mm-grid--list { grid-template-columns: 1fr; }

        @media (min-width: 480px) {
          .mm-grid--grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 768px) {
          .mm-grid--grid { grid-template-columns: repeat(4, 1fr); }
        }

        /* ── card ───────────────────────────────────── */
        .mm-card {
          background: #fff;
          border-radius: 14px;
          overflow: hidden;
          cursor: pointer;
          transition: transform .2s, box-shadow .2s;
          border: 1px solid #ece9e3;
          animation: mm-fadein .3s ease both;
        }
        @keyframes mm-fadein {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mm-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0,0,0,.1);
        }
        .mm-card:active { transform: scale(.98); }

        /* list mode card */
        .mm-grid--list .mm-card {
          display: flex;
          align-items: flex-start;
          border-radius: 12px;
        }
        .mm-grid--list .mm-card-img-wrap { width: 110px; min-width: 110px; height: 110px; }
        .mm-grid--list .mm-card-body { padding: 12px 12px 12px 0; }

        /* img wrap */
        .mm-card-img-wrap {
          position: relative;
          aspect-ratio: 1;
          overflow: hidden;
          background: #f5f4f0;
        }
        .mm-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform .4s ease;
        }
        .mm-card:hover .mm-card-img { transform: scale(1.04); }

        .mm-card-img-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ccc;
          background: #f0eeea;
        }

        /* badges */
        .mm-condition {
          position: absolute;
          top: 8px;
          left: 8px;
          padding: 3px 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .mm-condition--new { background: #16a34a; color: #fff; }
        .mm-condition--used { background: #6366f1; color: #fff; }
        .mm-condition--refurbished { background: #f59e0b; color: #fff; }

        /* wishlist btn */
        .mm-wishlist {
          position: absolute;
          bottom: 8px;
          right: 8px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(255,255,255,.9);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #cc3300;
          box-shadow: 0 2px 8px rgba(0,0,0,.15);
          transition: transform .15s;
        }
        .mm-wishlist:hover { transform: scale(1.15); }
        .mm-wishlist--active { background: #fff4f0; }

        /* card body */
        .mm-card-body { padding: 10px 10px 12px; }
        .mm-card-name {
          font-size: 13px;
          font-weight: 600;
          line-height: 1.3;
          color: #1a1a1a;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-bottom: 4px;
        }
        .mm-card-loc {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 11px;
          color: #999;
          margin-bottom: 6px;
        }
        .mm-card-loc span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .mm-price-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .mm-price {
          font-size: 15px;
          font-weight: 800;
          color: #ff5722;
        }
        .mm-original {
          font-size: 11px;
          color: #bbb;
          text-decoration: line-through;
        }
        .mm-badge {
          background: #fff4f0;
          color: #ff5722;
          font-size: 10px;
          font-weight: 700;
          border-radius: 4px;
          padding: 2px 5px;
        }

        .mm-card-rating {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 11px;
          color: #f59e0b;
          margin-top: 5px;
        }

        /* ── skeleton ────────────────────────────────── */
        .mm-card--skeleton { pointer-events: none; }
        .mm-skel {
          border-radius: 6px;
          background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
          background-size: 200% 100%;
          animation: mm-shimmer 1.4s infinite;
        }
        .mm-skel-img { aspect-ratio: 1; width: 100%; border-radius: 0; }
        .mm-skel-line { height: 12px; margin-bottom: 8px; }
        @keyframes mm-shimmer {
          from { background-position: 200% 0; }
          to   { background-position: -200% 0; }
        }

        /* ── states ──────────────────────────────────── */
        .mm-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 24px;
          text-align: center;
          gap: 12px;
          color: #bbb;
          grid-column: 1 / -1;
        }
        .mm-empty-icon {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: #f5f4f0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ddd;
          margin-bottom: 4px;
        }
        .mm-empty h3 { font-size: 16px; color: #555; }
        .mm-empty p  { font-size: 13px; }

        .mm-error {
          text-align: center;
          padding: 40px 24px;
          grid-column: 1 / -1;
        }
        .mm-error p { color: #dc2626; margin-bottom: 12px; font-size: 14px; }
        .mm-retry-btn {
          padding: 10px 24px;
          background: #ff5722;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .mm-loader-row {
          grid-column: 1 / -1;
          display: flex;
          justify-content: center;
          padding: 20px;
        }
        .mm-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid #f0eeea;
          border-top-color: #ff5722;
          border-radius: 50%;
          animation: mm-spin .7s linear infinite;
        }
        @keyframes mm-spin { to { transform: rotate(360deg); } }

        /* ── filter drawer ───────────────────────────── */
        .mm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.45);
          z-index: 300;
          animation: mm-fadeinbg .2s;
        }
        @keyframes mm-fadeinbg { from { opacity: 0; } to { opacity: 1; } }

        .mm-drawer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #fff;
          border-radius: 20px 20px 0 0;
          padding: 20px;
          z-index: 400;
          animation: mm-slideup .25s ease;
          max-height: 80vh;
          overflow-y: auto;
        }
        @keyframes mm-slideup {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }

        .mm-drawer-handle {
          width: 40px;
          height: 4px;
          background: #e8e6e0;
          border-radius: 2px;
          margin: 0 auto 20px;
        }
        .mm-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .mm-drawer-title {
          font-size: 16px;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .mm-drawer-close {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1.5px solid #e8e6e0;
          background: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #555;
        }

        .mm-filter-section { margin-bottom: 24px; }
        .mm-filter-label {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #888;
          margin-bottom: 12px;
        }

        .mm-filter-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .mm-chip {
          padding: 6px 14px;
          border-radius: 999px;
          border: 1.5px solid #e8e6e0;
          background: #fafaf8;
          font-size: 13px;
          cursor: pointer;
          transition: all .15s;
        }
        .mm-chip:hover { border-color: #ff5722; color: #ff5722; }
        .mm-chip--active {
          background: #ff5722;
          border-color: #ff5722;
          color: #fff;
          font-weight: 600;
        }

        .mm-price-range {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .mm-price-input {
          height: 42px;
          border: 1.5px solid #e8e6e0;
          border-radius: 10px;
          padding: 0 12px;
          font-size: 14px;
          outline: none;
          background: #fafaf8;
          width: 100%;
          transition: border-color .15s;
        }
        .mm-price-input:focus { border-color: #ff5722; background: #fff; }

        .mm-drawer-footer {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding-top: 8px;
          border-top: 1px solid #f0eeea;
          margin-top: 4px;
        }
        .mm-btn-clear {
          height: 46px;
          border-radius: 12px;
          border: 1.5px solid #e8e6e0;
          background: #fff;
          font-size: 14px;
          font-weight: 600;
          color: #555;
          cursor: pointer;
        }
        .mm-btn-apply {
          height: 46px;
          border-radius: 12px;
          border: none;
          background: #ff5722;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity .15s;
        }
        .mm-btn-apply:hover { opacity: .9; }

        /* ── Post Ad FAB ──────────────────────────────── */
        .mm-fab {
          position: fixed;
          bottom: 84px;
          right: 18px;
          z-index: 90;
          display: flex;
          align-items: center;
          gap: 8px;
          height: 52px;
          padding: 0 20px;
          border-radius: 999px;
          border: none;
          background: linear-gradient(135deg, #ff5722, #ff8a00);
          color: #fff;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 6px 24px rgba(255,87,34,.45);
          transition: transform .2s, box-shadow .2s;
          letter-spacing: -0.2px;
        }
        .mm-fab:hover {
          transform: translateY(-3px) scale(1.03);
          box-shadow: 0 10px 32px rgba(255,87,34,.55);
        }
        .mm-fab:active { transform: scale(.97); }

        /* ── Post Ad top-bar button ───────────────────── */
        .mm-post-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 40px;
          padding: 0 14px;
          border-radius: 10px;
          border: none;
          background: #ff5722;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
          transition: opacity .15s, transform .15s;
          white-space: nowrap;
        }
        .mm-post-btn:hover { opacity: .9; transform: translateY(-1px); }
      `}</style>

      <div className="mm-page">
        {/* ── Top Bar ── */}
        <div className="mm-topbar">
          <div className="mm-topbar-row1">
            <div className="mm-logo-pill">Minimart</div>

            <div className="mm-search-wrap">
              <FiSearch size={15} />
              <input
                className="mm-search-input"
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="mm-search-clear" onClick={() => setSearch("")}>
                  <FiX size={14} />
                </button>
              )}
            </div>

            <button
              className={`mm-filter-btn ${activeFiltersCount ? "mm-filter-btn--active" : ""}`}
              onClick={() => setShowFilterDrawer(true)}
            >
              <FiSliders size={14} />
              Filter
              {activeFiltersCount > 0 && (
                <span className="mm-filter-dot">{activeFiltersCount}</span>
              )}
            </button>

            {user && (
              <button className="mm-post-btn" onClick={() => navigate("/minimart/add")}>
                <FiPlus size={15} />
                Sell
              </button>
            )}
          </div>

          {/* Category tabs */}
          <div className="mm-cats">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                className={`mm-cat-btn ${category === c.value ? "mm-cat-btn--active" : ""}`}
                onClick={() => setCategory(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Sub bar ── */}
        <div className="mm-subbar">
          <span className="mm-count">
            {loading && page === 1
              ? "Loading..."
              : totalCount > 0
              ? <><strong>{totalCount}</strong> products</>
              : ""}
          </span>

          <div className="mm-subbar-right">
            {/* Sort */}
            <div className="mm-sort-wrap" ref={sortRef}>
              <button
                className="mm-sort-btn"
                onClick={() => setShowSortMenu((p) => !p)}
              >
                {SORT_OPTIONS.find((s) => s.value === sort)?.label}
                <FiChevronDown size={13} />
              </button>
              {showSortMenu && (
                <div className="mm-sort-menu">
                  {SORT_OPTIONS.map((s) => (
                    <div
                      key={s.value}
                      className={`mm-sort-item ${sort === s.value ? "mm-sort-item--active" : ""}`}
                      onClick={() => {
                        setSort(s.value);
                        setShowSortMenu(false);
                      }}
                    >
                      {s.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* View toggle */}
            <div className="mm-view-toggle">
              <button
                className={`mm-view-btn ${viewMode === "grid" ? "mm-view-btn--active" : ""}`}
                onClick={() => setViewMode("grid")}
              >
                <FiGrid size={14} />
              </button>
              <button
                className={`mm-view-btn ${viewMode === "list" ? "mm-view-btn--active" : ""}`}
                onClick={() => setViewMode("list")}
              >
                <FiList size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Product Grid ── */}
        <div className={`mm-grid mm-grid--${viewMode}`}>
          {error ? (
            <div className="mm-error">
              <p>{error}</p>
              <button className="mm-retry-btn" onClick={() => { setPage(1); setProducts([]); }}>
                Retry
              </button>
            </div>
          ) : loading && page === 1 ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          ) : products.length === 0 ? (
            <div className="mm-empty">
              <div className="mm-empty-icon">
                <FiTag size={28} />
              </div>
              <h3>No products found</h3>
              <p>Try a different category or search term</p>
            </div>
          ) : (
            products.map((p) => (
              <ProductCard key={p._id || p.id} product={p} user={user} />
            ))
          )}

          {/* Infinite scroll sentinel */}
          {!error && (loading && page > 1 ? (
            <div className="mm-loader-row">
              <div className="mm-spinner" />
            </div>
          ) : hasMore ? (
            <div ref={loaderRef} style={{ height: 1 }} />
          ) : products.length > 0 ? (
            <div className="mm-empty" style={{ padding: "20px", fontSize: 12, color: "#bbb" }}>
              You've seen all products
            </div>
          ) : null)}
        </div>
      </div>

      {/* ── Filter Drawer ── */}
      {showFilterDrawer && (
        <>
          <div className="mm-overlay" onClick={() => setShowFilterDrawer(false)} />
          <div className="mm-drawer">
            <div className="mm-drawer-handle" />
            <div className="mm-drawer-header">
              <div className="mm-drawer-title">
                <FiFilter size={16} /> Filters
              </div>
              <button className="mm-drawer-close" onClick={() => setShowFilterDrawer(false)}>
                <FiX size={15} />
              </button>
            </div>

            {/* Condition */}
            <div className="mm-filter-section">
              <div className="mm-filter-label">Condition</div>
              <div className="mm-filter-chips">
                {["", "new", "used", "refurbished"].map((c) => (
                  <button
                    key={c}
                    className={`mm-chip ${condition === c ? "mm-chip--active" : ""}`}
                    onClick={() => setCondition(c)}
                  >
                    {c === "" ? "Any" : c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Price range */}
            <div className="mm-filter-section">
              <div className="mm-filter-label">Price Range (₦)</div>
              <div className="mm-price-range">
                <input
                  className="mm-price-input"
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
                <input
                  className="mm-price-input"
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="mm-drawer-footer">
              <button
                className="mm-btn-clear"
                onClick={() => {
                  clearFilters();
                  setShowFilterDrawer(false);
                }}
              >
                Clear All
              </button>
              <button
                className="mm-btn-apply"
                onClick={() => setShowFilterDrawer(false)}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Floating Post Ad Button ── */}
      <button
        className="mm-fab"
        onClick={() => user ? setShowPostAds(true) : navigate("/auth")}
      >
        <FiPlus size={18} />
        Post Ad
      </button>

      {/* ── PostAds Bottom Sheet ── */}
      {showPostAds && (
        <PostAds
          user={user}
          onClose={() => setShowPostAds(false)}
          onPosted={() => {
            setShowPostAds(false);
            setPage(1);
            setProducts([]);
            setHasMore(true);
          }}
        />
      )}
    </>
  );
}
