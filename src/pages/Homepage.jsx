/**
 * Homepage.jsx — Minimart
 *
 * Fonts — add to public/index.html <head>:
 *   <link rel="preconnect" href="https://fonts.googleapis.com" />
 *   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
 *   <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;0,9..144,700;0,9..144,800;1,9..144,300&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
 */

import React, {
  useEffect, useState, useCallback,
  useRef, memo, useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";
import TopNav    from "../components/TopNav";
import BottomNav from "../components/BottomNav";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const API   = import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";
const PH    = "https://placehold.co/600x500/e8e4dc/b0a89e?text=Minimart";
const HOVER = 900; // ms hover before counting as a view
const GPS_O = { timeout: 5000, enableHighAccuracy: false, maximumAge: 300_000 };

const CATEGORIES = [
  { id: "all",         label: "All",        icon: "✦" },
  { id: "electronics", label: "Electronics", icon: "📱" },
  { id: "fashion",     label: "Fashion",     icon: "👗" },
  { id: "vehicles",    label: "Vehicles",    icon: "🚗" },
  { id: "furniture",   label: "Furniture",   icon: "🛋" },
  { id: "phones",      label: "Phones",      icon: "☎" },
  { id: "food",        label: "Food",        icon: "🥘" },
  { id: "services",    label: "Services",    icon: "🔧" },
];

/* ─────────────────────────────────────────────
   PURE HELPERS
───────────────────────────────────────────── */
const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG");

const img = (p) => {
  const f = Array.isArray(p?.images) ? p.images[0] : null;
  if (!f) return PH;
  return typeof f === "string" ? f : f.url || f.thumbnail_url || PH;
};

const fresh = (d) => Date.now() - new Date(d).getTime() < 86_400_000;

const dedup = (arr) => {
  const s = new Set();
  return arr.filter((p) => !s.has(p.id) && s.add(p.id));
};

const split = (products) => ({
  featured: products.filter((p) => p.is_promoted).slice(0, 3),
  nearby:   products.filter((p) => p.distance_km != null).slice(0, 10),
  trending: products.filter((p) => (p.views || 0) > 3).slice(0, 14),
  deals:    products.filter((p) => p.price <= 20_000),
  latest:   products,
});

const ctrlBadge = (ctr) => {
  if (!ctr) return null;
  if (ctr > 0.15) return { t: "Hot",     c: "bd-hot" };
  if (ctr > 0.08) return { t: "Trending",c: "bd-trnd" };
  return null;
};

/* ─────────────────────────────────────────────
   STYLES
───────────────────────────────────────────── */
const CSS = `
  /* ── TOKENS ── */
  :root {
    --o:   #FF5C00;
    --o2:  #FF8040;
    --o-bg:#FFF3EE;
    --ink: #141210;
    --ink2:#5A5650;
    --ink3:#A8A39D;
    --bg:  #F7F4EF;
    --wh:  #FFFFFF;
    --bd:  #EAE6E0;
    --bd2: #D8D4CE;
    --gn:  #15803D;
    --gn2: #DCFCE7;
    --r1:8px; --r2:16px; --r3:24px;
    --s1:0 1px 3px rgba(0,0,0,.06);
    --s2:0 4px 20px rgba(0,0,0,.08);
    --s3:0 16px 48px rgba(0,0,0,.12);
    --fd:'Fraunces',Georgia,serif;
    --fb:'Plus Jakarta Sans',system-ui,sans-serif;
  }
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); font-family:var(--fb); color:var(--ink); -webkit-font-smoothing:antialiased; }
  button { font-family:var(--fb); }

  /* ── PAGE ── */
  .pg { padding-bottom:92px; }

  /* ── ENTRANCE ANIMATION ── */
  @keyframes up {
    from { opacity:0; transform:translateY(16px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity:0; }
    to   { opacity:1; }
  }
  @keyframes pulse-ring {
    0%   { transform:scale(1);   opacity:.6; }
    100% { transform:scale(1.9); opacity:0;  }
  }
  @keyframes shimmer {
    from { background-position:-800px 0; }
    to   { background-position: 800px 0; }
  }
  @keyframes fab-bounce {
    0%,100% { transform:translateY(0); }
    50%     { transform:translateY(-4px); }
  }

  .anim { animation:up .4s ease both; }
  .anim-1 { animation-delay:.05s; }
  .anim-2 { animation-delay:.10s; }
  .anim-3 { animation-delay:.15s; }
  .anim-4 { animation-delay:.20s; }
  .anim-5 { animation-delay:.25s; }

  /* ── HERO ── */
  .hero {
    background:var(--ink);
    padding:20px 18px 0;
    position:relative; overflow:hidden;
  }
  /* warm glow blobs */
  .hero::before {
    content:''; position:absolute; top:-80px; right:-60px;
    width:260px; height:260px;
    background:radial-gradient(circle, rgba(255,92,0,.20) 0%, transparent 65%);
    border-radius:50%; pointer-events:none;
  }
  .hero::after {
    content:''; position:absolute; bottom:-40px; left:-20px;
    width:160px; height:160px;
    background:radial-gradient(circle, rgba(255,92,0,.08) 0%, transparent 70%);
    border-radius:50%; pointer-events:none;
  }

  .hero-top {
    display:flex; align-items:flex-start; justify-content:space-between;
    margin-bottom:14px;
  }
  .hero-kicker {
    font-family:var(--fb); font-size:10px; font-weight:700;
    letter-spacing:.16em; text-transform:uppercase;
    color:var(--o); margin-bottom:8px;
    display:flex; align-items:center; gap:6px;
  }
  .hero-kicker::before {
    content:''; display:block; width:18px; height:2px;
    background:var(--o); border-radius:999px;
  }
  .hero-h1 {
    font-family:var(--fd); font-size:28px; font-weight:700;
    color:#fff; line-height:1.08; max-width:220px;
    font-feature-settings:'dlig' 1;
  }
  .hero-h1 i { font-style:italic; color:var(--o2); font-weight:300; }
  .hero-notify {
    width:36px; height:36px; border-radius:50%;
    background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12);
    display:flex; align-items:center; justify-content:center;
    font-size:16px; cursor:pointer; flex-shrink:0;
    transition:background .15s;
  }
  .hero-notify:hover { background:rgba(255,255,255,.15); }

  /* location pill */
  .hero-loc {
    display:inline-flex; align-items:center; gap:7px;
    background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12);
    border-radius:999px; padding:6px 12px 6px 8px;
    font-size:12px; font-weight:500; color:rgba(255,255,255,.75);
    cursor:pointer; transition:background .15s; margin-bottom:18px;
  }
  .hero-loc:hover { background:rgba(255,255,255,.12); }
  .loc-dot {
    width:8px; height:8px; border-radius:50%;
    background:var(--o); position:relative; flex-shrink:0;
  }
  .loc-dot::after {
    content:''; position:absolute; inset:-3px;
    border-radius:50%; background:rgba(255,92,0,.35);
    animation:pulse-ring .9s ease-out infinite;
  }

  /* stats strip */
  .hero-stats {
    display:flex; gap:0;
    border-top:1px solid rgba(255,255,255,.08);
  }
  .hero-stat {
    flex:1; padding:14px 0; text-align:center;
    border-right:1px solid rgba(255,255,255,.08);
  }
  .hero-stat:last-child { border-right:none; }
  .hero-stat-n {
    font-family:var(--fd); font-size:18px; font-weight:700;
    color:#fff; line-height:1;
  }
  .hero-stat-l {
    font-size:9.5px; font-weight:500; color:rgba(255,255,255,.4);
    letter-spacing:.06em; text-transform:uppercase; margin-top:3px;
  }

  /* ── SEARCH ── */
  .search-wrap { padding:14px 16px 0; }
  .search {
    display:flex; align-items:center; gap:10px;
    background:var(--wh); border:1.5px solid var(--bd);
    border-radius:var(--r2); padding:13px 15px;
    box-shadow:var(--s1); cursor:pointer;
    transition:border-color .15s, box-shadow .15s;
  }
  .search:hover { border-color:var(--o2); box-shadow:var(--s2); }
  .search-ic  { font-size:15px; color:var(--ink3); flex-shrink:0; }
  .search-txt { flex:1; font-size:14px; color:var(--ink3); }
  .search-tag {
    font-size:10px; color:var(--ink3); background:var(--bg);
    border:1px solid var(--bd2); border-radius:5px; padding:2px 7px;
  }

  /* ── CATEGORY STRIP ── */
  .cat-strip {
    display:flex; gap:8px; padding:14px 16px 0;
    overflow-x:auto; scrollbar-width:none;
  }
  .cat-strip::-webkit-scrollbar { display:none; }
  .cat-btn {
    display:flex; align-items:center; gap:5px;
    background:var(--wh); border:1.5px solid var(--bd);
    border-radius:999px; padding:7px 13px;
    font-size:12.5px; font-weight:600; color:var(--ink2);
    cursor:pointer; white-space:nowrap; flex-shrink:0;
    transition:border-color .15s, background .15s, color .15s, transform .12s;
    box-shadow:var(--s1);
  }
  .cat-btn:hover { border-color:var(--o); color:var(--o); transform:translateY(-1px); box-shadow:var(--s2); }
  .cat-btn.active {
    background:var(--o); border-color:var(--o); color:#fff;
    box-shadow:0 4px 14px rgba(255,92,0,.30);
  }
  .cat-btn.active:hover { transform:translateY(-1px); }
  .cat-icon { font-size:13px; }

  /* ── SECTION ── */
  .sec { margin-top:28px; }
  .sec-head {
    display:flex; align-items:center; justify-content:space-between;
    padding:0 16px 12px;
  }
  .sec-label {
    display:flex; align-items:center; gap:10px;
  }
  .sec-title {
    font-family:var(--fd); font-size:19px; font-weight:700;
    color:var(--ink); line-height:1;
  }
  .sec-chip {
    font-size:9px; font-weight:700; letter-spacing:.08em;
    text-transform:uppercase; border-radius:5px;
    padding:3px 7px;
    background:var(--o); color:#fff;
  }
  .sec-chip.gn { background:var(--gn); }
  .see-all {
    font-size:12.5px; font-weight:700; color:var(--o);
    cursor:pointer; background:none; border:none; padding:0;
    display:flex; align-items:center; gap:3px;
  }
  .see-all:hover { text-decoration:underline; }

  /* ── SCROLL ROW ── */
  .row {
    display:flex; gap:12px; padding:3px 16px 10px;
    overflow-x:auto; scroll-snap-type:x mandatory;
    -webkit-overflow-scrolling:touch; scrollbar-width:none;
  }
  .row::-webkit-scrollbar { display:none; }
  .row > * { scroll-snap-align:start; }

  /* ── GRID ── */
  .grid2 { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; padding:3px 16px 10px; }

  /* ── CARD — OVERLAY (hero image, info overlaid) ── */
  .co {
    width:158px; border-radius:var(--r2); overflow:hidden;
    cursor:pointer; flex-shrink:0; position:relative;
    box-shadow:var(--s1); background:var(--bd);
    transition:transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s;
  }
  .co:hover { transform:translateY(-4px) scale(1.01); box-shadow:var(--s3); }
  .co:active { transform:scale(.96); }
  .co-img {
    width:100%; height:200px; object-fit:cover; display:block;
    background:var(--bd);
  }
  .co-grad {
    position:absolute; bottom:0; left:0; right:0;
    background:linear-gradient(to top, rgba(14,10,6,.92) 0%, rgba(14,10,6,.60) 45%, transparent 100%);
    padding:36px 10px 10px;
  }
  .co-name {
    font-size:12.5px; font-weight:600; color:#fff; line-height:1.3;
    display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden;
    margin-bottom:5px;
  }
  .co-price {
    font-family:var(--fd); font-size:15px; font-weight:700; color:var(--o2);
  }
  .co-foot {
    display:flex; align-items:center; justify-content:space-between;
    margin-top:4px;
  }
  .co-loc { font-size:10px; color:rgba(255,255,255,.55); }

  /* ── CARD — GRID TILE ── */
  .ct {
    border-radius:var(--r2); overflow:hidden; position:relative;
    cursor:pointer; background:var(--wh); border:1.5px solid var(--bd);
    box-shadow:var(--s1);
    transition:transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s;
  }
  .ct:hover { transform:translateY(-3px); box-shadow:var(--s2); }
  .ct:active { transform:scale(.96); }
  .ct-img { width:100%; height:130px; object-fit:cover; display:block; background:var(--bd); }
  .ct-body { padding:9px 10px 11px; }
  .ct-name {
    font-size:12.5px; font-weight:600; color:var(--ink); line-height:1.35;
    display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden;
    margin-bottom:5px;
  }
  .ct-price { font-family:var(--fd); font-size:14.5px; font-weight:700; color:var(--o); }
  .ct-loc   { font-size:10px; color:var(--ink3); margin-top:3px; }

  /* ── TRUST BAR ── */
  .trust { display:flex; align-items:center; gap:5px; margin-top:6px; }
  .trust-track { flex:1; height:3px; background:var(--bd); border-radius:999px; overflow:hidden; }
  .trust-fill  { height:100%; background:var(--gn); border-radius:999px; }
  .trust-lbl   { font-size:9.5px; color:var(--ink3); white-space:nowrap; }

  /* ── FEATURED CARD (dark landscape) ── */
  .feat-wrap { padding:2px 16px 4px; }
  .feat {
    display:flex; height:128px; border-radius:var(--r3);
    overflow:hidden; cursor:pointer; position:relative;
    background:var(--ink); border:1px solid rgba(255,255,255,.06);
    box-shadow:var(--s2); margin-bottom:10px;
    transition:transform .18s, box-shadow .18s;
  }
  .feat:hover { transform:scale(1.01); box-shadow:var(--s3); }
  .feat:active { transform:scale(.97); }
  .feat-img { width:128px; flex-shrink:0; object-fit:cover; display:block; }
  .feat-body { flex:1; padding:14px 15px; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden; }
  .feat-tag {
    font-size:8.5px; font-weight:700; letter-spacing:.14em;
    text-transform:uppercase; color:var(--o);
    display:flex; align-items:center; gap:5px;
  }
  .feat-tag::before { content:''; display:block; width:12px; height:1.5px; background:var(--o); }
  .feat-name {
    font-family:var(--fd); font-size:14.5px; font-weight:700; color:#fff;
    line-height:1.18; display:-webkit-box; -webkit-box-orient:vertical;
    -webkit-line-clamp:2; overflow:hidden;
  }
  .feat-price { font-family:var(--fd); font-size:18px; font-weight:700; color:var(--o2); }
  .feat-loc   { font-size:10px; color:rgba(255,255,255,.38); margin-top:1px; }

  /* ── BADGES ── */
  .bd {
    position:absolute; top:8px; left:8px; z-index:3;
    font-size:8.5px; font-weight:700; letter-spacing:.08em;
    text-transform:uppercase; border-radius:5px; padding:3px 7px;
  }
  .bd-feat  { background:var(--gn); color:#fff; }
  .bd-new   { background:var(--o);  color:#fff; }
  .bd-hot   { background:#DC2626; color:#fff; }
  .bd-trnd  { background:#7C3AED; color:#fff; }

  /* rank number */
  .rank {
    position:absolute; top:8px; right:9px; z-index:3;
    font-family:var(--fd); font-size:24px; font-weight:700;
    color:rgba(255,255,255,.22); line-height:1;
    text-shadow:0 2px 8px rgba(0,0,0,.3);
  }

  /* verified */
  .vfd {
    display:inline-flex; align-items:center; gap:3px;
    font-size:9.5px; font-weight:700; color:var(--gn);
    background:var(--gn2); border-radius:4px; padding:2px 6px; margin-top:4px;
  }
  /* distance */
  .dist {
    font-size:9.5px; font-weight:600; color:var(--gn);
    background:var(--gn2); border-radius:4px; padding:2px 6px; flex-shrink:0;
  }

  /* ── DIVIDER ── */
  .divider { height:1px; background:var(--bd); margin:28px 16px 0; }

  /* ── LOAD MORE ── */
  .load-more {
    display:block; margin:10px 16px 0; width:calc(100% - 32px);
    padding:14px; border:1.5px solid var(--bd2); border-radius:var(--r2);
    background:var(--wh); font-size:13.5px; font-weight:700;
    color:var(--ink2); cursor:pointer; text-align:center;
    transition:border-color .15s, color .15s, background .15s, transform .12s;
    box-shadow:var(--s1);
  }
  .load-more:hover {
    border-color:var(--o); color:var(--o); background:var(--o-bg);
    transform:translateY(-1px); box-shadow:var(--s2);
  }
  .load-more:active { transform:scale(.98); }
  .load-more:disabled { opacity:.45; pointer-events:none; }

  /* ── SKELETON ── */
  .sk {
    background:linear-gradient(90deg, var(--bd) 25%, #E8E4DC 50%, var(--bd) 75%);
    background-size:1600px 100%;
    animation:shimmer 1.6s infinite linear;
    border-radius:var(--r2);
  }
  .sk-co  { width:158px; height:200px; flex-shrink:0; }
  .sk-ct  { height:210px; }
  .sk-ft  { height:128px; border-radius:var(--r3); margin-bottom:10px; }

  /* ── EMPTY STATE ── */
  .empty {
    margin:36px 16px; padding:40px 24px;
    background:var(--wh); border:1.5px solid var(--bd);
    border-radius:var(--r3); text-align:center;
    box-shadow:var(--s1); animation:fadeIn .4s ease;
  }
  .empty-emoji { font-size:48px; margin-bottom:14px; }
  .empty-title {
    font-family:var(--fd); font-size:22px; font-weight:700;
    color:var(--ink); margin-bottom:8px;
  }
  .empty-sub {
    font-size:14px; color:var(--ink2); line-height:1.55;
    margin-bottom:24px; max-width:260px; margin-left:auto; margin-right:auto;
  }
  .empty-btn {
    background:var(--o); color:#fff; border:none;
    border-radius:999px; padding:13px 32px;
    font-size:14px; font-weight:700; cursor:pointer;
    box-shadow:0 6px 20px rgba(255,92,0,.35);
    transition:transform .15s, box-shadow .15s;
  }
  .empty-btn:hover { transform:translateY(-2px); box-shadow:0 10px 28px rgba(255,92,0,.40); }

  /* ── ERROR STATE ── */
  .err-box {
    margin:28px 16px; padding:24px;
    background:#FFF5F5; border:1.5px solid #FEC5C5;
    border-radius:var(--r2); text-align:center;
    animation:fadeIn .3s ease;
  }
  .err-icon  { font-size:32px; margin-bottom:10px; }
  .err-title { font-family:var(--fd); font-size:17px; font-weight:700; color:#991B1B; margin-bottom:6px; }
  .err-msg   { font-size:13px; color:#B91C1C; margin-bottom:16px; line-height:1.5; }
  .err-btn {
    border:1.5px solid #EF4444; background:none; border-radius:999px;
    padding:9px 24px; font-size:13px; font-weight:700;
    color:#EF4444; cursor:pointer; transition:background .15s, color .15s;
  }
  .err-btn:hover { background:#EF4444; color:#fff; }

  /* ── LOADING MORE ── */
  .loading-more { text-align:center; padding:16px; font-size:12px; color:var(--ink3); }
  .loading-more::after { content:' ●'; animation:fadeIn .6s .2s infinite alternate; }

  /* ── INLINE EMPTY ── */
  .inline-empty { padding:22px 16px; font-size:13px; color:var(--ink3); text-align:center; }

  /* ── FAB ── */
  .fab {
    position:fixed; bottom:76px; right:16px; z-index:50;
    display:flex; align-items:center; gap:7px;
    background:var(--o); color:#fff; border:none;
    border-radius:999px; padding:13px 22px;
    font-size:14px; font-weight:700; cursor:pointer;
    letter-spacing:.01em;
    box-shadow:0 8px 28px rgba(255,92,0,.45), 0 2px 8px rgba(255,92,0,.25);
    transition:transform .15s cubic-bezier(.34,1.56,.64,1), box-shadow .15s;
    animation:fab-bounce 3.5s ease-in-out 1.5s infinite;
  }
  .fab:hover {
    transform:translateY(-3px) scale(1.04);
    box-shadow:0 14px 36px rgba(255,92,0,.50);
    animation:none;
  }
  .fab:active { transform:scale(.95); animation:none; }
  .fab-ic { font-size:18px; font-weight:400; line-height:1; }
`;

/* ─────────────────────────────────────────────
   SKELETON ROWS
───────────────────────────────────────────── */
const SkelRow  = () => (
  <div className="row">
    {[...Array(5)].map((_, i) => <div key={i} className="sk sk-co" />)}
  </div>
);
const SkelGrid = () => (
  <div className="grid2">
    {[...Array(4)].map((_, i) => <div key={i} className="sk sk-ct" />)}
  </div>
);

/* ─────────────────────────────────────────────
   CARD — OVERLAY (horizontal scroll)
───────────────────────────────────────────── */
const CardO = memo(({ p, rank, priority, onView, onClick }) => {
  const timer = useRef(null);
  const b     = ctrlBadge(p.ctr);

  return (
    <div
      className="co"
      role="button" tabIndex={0}
      onClick={() => onClick(p)}
      onKeyDown={(e) => e.key === "Enter" && onClick(p)}
      onMouseEnter={() => { timer.current = setTimeout(() => onView(p.id), HOVER); }}
      onMouseLeave={() => clearTimeout(timer.current)}
    >
      {/* badge priority: promoted > hot/trending > new */}
      {p.is_promoted      && <span className="bd bd-feat">Sponsored</span>}
      {!p.is_promoted && b  && <span className={`bd ${b.c}`}>{b.t}</span>}
      {!p.is_promoted && !b && fresh(p.createdAt) && <span className="bd bd-new">New</span>}
      {rank != null         && <span className="rank">#{rank + 1}</span>}

      <img
        className="co-img"
        src={img(p)} alt={p.title}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
      />
      <div className="co-grad">
        <div className="co-name">{p.title}</div>
        <div className="co-price">{naira(p.price)}</div>
        <div className="co-foot">
          <span className="co-loc">📍 {p.location?.city || "Nationwide"}</span>
          {p.distance_km != null && <span className="dist">{p.distance_km} km</span>}
        </div>
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────
   CARD — GRID TILE
───────────────────────────────────────────── */
const CardT = memo(({ p, onView, onClick }) => {
  const timer = useRef(null);
  const b     = ctrlBadge(p.ctr);

  return (
    <div
      className="ct"
      role="button" tabIndex={0}
      onClick={() => onClick(p)}
      onKeyDown={(e) => e.key === "Enter" && onClick(p)}
      onMouseEnter={() => { timer.current = setTimeout(() => onView(p.id), HOVER); }}
      onMouseLeave={() => clearTimeout(timer.current)}
    >
      {p.is_promoted      && <span className="bd bd-feat">Sponsored</span>}
      {!p.is_promoted && b  && <span className={`bd ${b.c}`}>{b.t}</span>}
      {!p.is_promoted && !b && fresh(p.createdAt) && <span className="bd bd-new">New</span>}

      <img className="ct-img" src={img(p)} alt={p.title} loading="lazy" decoding="async" />
      <div className="ct-body">
        <div className="ct-name">{p.title}</div>
        <div className="ct-price">{naira(p.price)}</div>
        <div className="ct-loc">📍 {p.location?.city || "Nationwide"}</div>
        {p.seller?.verified && <div className="vfd">✓ Verified seller</div>}
        {p.seller?.trust_score != null && (
          <div className="trust">
            <div className="trust-track">
              <div className="trust-fill" style={{ width: `${p.seller.trust_score}%` }} />
            </div>
            <span className="trust-lbl">{p.seller.trust_score}%</span>
          </div>
        )}
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────
   FEATURED CARD (dark landscape banner)
───────────────────────────────────────────── */
const FeatCard = memo(({ p, onClick }) => (
  <div className="feat" role="button" tabIndex={0}
    onClick={() => onClick(p)}
    onKeyDown={(e) => e.key === "Enter" && onClick(p)}
  >
    <img className="feat-img" src={img(p)} alt={p.title} loading="eager" decoding="async" fetchPriority="high" />
    <div className="feat-body">
      <div>
        <div className="feat-tag">Sponsored</div>
        <div className="feat-name">{p.title}</div>
      </div>
      <div>
        <div className="feat-price">{naira(p.price)}</div>
        <div className="feat-loc">📍 {p.location?.city || "Nationwide"}</div>
      </div>
    </div>
  </div>
));

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function Homepage({ user }) {
  const navigate = useNavigate();
  const { setProducts, setLoaded } = useProductCache();

  const [sec,          setSec]          = useState({ featured:[], nearby:[], trending:[], deals:[], latest:[] });
  const [meta,         setMeta]         = useState({});
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [cat,          setCat]          = useState("all");
  const [dealsVis,     setDealsVis]     = useState(6);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [hasMore,      setHasMore]      = useState(false);
  const [page,         setPage]         = useState(0);

  const poolRef     = useRef([]);   // all products, accumulated
  const sentinelRef = useRef(null);

  /* ── HANDLERS ── */
  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  const handleClick = useCallback((p) => {
    fetch(`${API}/products/${p.id}/click`, { method: "POST" }).catch(() => {});
    navigate(`/product/${p.slug}`);
  }, [navigate]);

  /* ── FEED PIPELINE ── */
  const applyData = useCallback((data, append = false) => {
    const incoming = data.products ?? [
      ...(data.recommended || []),
      ...(data.cheapDeals  || []),
      ...(data.trending    || []),
      ...(data.latest      || []),
    ];

    const merged = append
      ? dedup([...poolRef.current, ...incoming])
      : dedup(incoming);

    poolRef.current = merged;
    setProducts(merged);
    setSec(split(merged));
    setMeta(data.meta || {});
    setHasMore(incoming.length >= 20);
    setLoaded(true);
  }, [setProducts, setLoaded]);

  /* ── INITIAL LOAD ── */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPage(0);
    poolRef.current = [];

    const go = async (qs = "") => {
      const res = await fetch(`${API}/homepage${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };

    try {
      // GPS race against 5 s timeout
      const data = await new Promise((resolve, reject) => {
        let done = false;
        const finish = (fn) => { if (done) return; done = true; fn(); };

        const timer = setTimeout(() => finish(() => go().then(resolve).catch(reject)), 5000);

        navigator.geolocation?.getCurrentPosition(
          (pos) => finish(() => {
            clearTimeout(timer);
            go(`?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`)
              .then(resolve).catch(() => go().then(resolve).catch(reject));
          }),
          ()    => finish(() => { clearTimeout(timer); go().then(resolve).catch(reject); }),
          GPS_O
        ) ?? finish(() => { clearTimeout(timer); go().then(resolve).catch(reject); });
      });

      applyData(data);
    } catch (e) {
      console.error(e);
      setError("Could not reach the marketplace. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  /* ── LOAD MORE (infinite scroll on Latest) ── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res  = await fetch(`${API}/homepage?page=${next}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      applyData(data, true);
      setPage(next);
    } catch {
      /* silently ignore — user can scroll back */
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, applyData]);

  /* ── EFFECTS ── */
  useEffect(() => { load(); }, []); // eslint-disable-line

  // Re-fetch when tab becomes visible again
  useEffect(() => {
    const h = () => { if (document.visibilityState === "visible" && !loading) load(); };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, [loading, load]);

  // Infinite scroll sentinel
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  /* ── DERIVED ── */
  const locLabel = meta.location || (meta.nearbySource === "gps" ? "Near you" : null);

  // Category filter (client-side on current pool)
  const filtered = useMemo(() => {
    if (cat === "all") return sec;
    const f = poolRef.current.filter((p) => p.category_id === cat || p.category === cat);
    return split(f);
  }, [cat, sec]);

  /* ── RENDER ── */
  return (
    <>
      <style>{CSS}</style>
      <TopNav />

      <div className="pg">

        {/* ═══ HERO ═══ */}
        <div className="hero">
          <div className="hero-top anim">
            <div>
              <div className="hero-kicker">Minimart Marketplace</div>
              <div className="hero-h1">
                Buy &amp; sell<br /><i>near you</i>
              </div>
            </div>
            <button className="hero-notify" aria-label="Notifications">🔔</button>
          </div>

          {locLabel && (
            <div className="hero-loc anim anim-1" onClick={() => navigate("/nearby")}>
              <span className="loc-dot" />
              {locLabel}
              {meta.nearbySource === "gps" && " · GPS"}
            </div>
          )}

          <div className="hero-stats anim anim-2">
            <div className="hero-stat">
              <div className="hero-stat-n">
                {loading ? "—" : `${(poolRef.current.length || 0) + 1000}+`}
              </div>
              <div className="hero-stat-l">Listings</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-n">{loading ? "—" : "24/7"}</div>
              <div className="hero-stat-l">Live market</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-n">{loading ? "—" : "Free"}</div>
              <div className="hero-stat-l">To list</div>
            </div>
          </div>
        </div>

        {/* ═══ SEARCH ═══ */}
        <div className="search-wrap anim anim-3">
          <div className="search" onClick={() => navigate("/search")}>
            <span className="search-ic">🔍</span>
            <span className="search-txt">Search products, categories…</span>
            <span className="search-tag">⌘ K</span>
          </div>
        </div>

        {/* ═══ CATEGORY STRIP ═══ */}
        <div className="cat-strip anim anim-4">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`cat-btn${cat === c.id ? " active" : ""}`}
              onClick={() => setCat(c.id)}
            >
              <span className="cat-icon">{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>

        {/* ═══ ERROR ═══ */}
        {error && (
          <div className="err-box">
            <div className="err-icon">⚡</div>
            <div className="err-title">Marketplace unavailable</div>
            <div className="err-msg">{error}</div>
            <button className="err-btn" onClick={load}>Try again</button>
          </div>
        )}

        {/* ═══ GLOBAL EMPTY ═══ */}
        {!loading && !error && filtered.latest.length === 0 && (
          <div className="empty">
            <div className="empty-emoji">🛍</div>
            <div className="empty-title">Welcome to Minimart</div>
            <div className="empty-sub">
              Enable location for nearby deals, or browse what's available across Nigeria.
            </div>
            <button className="empty-btn" onClick={load}>Load Marketplace</button>
          </div>
        )}

        {/* ═══ FEATURED ═══ */}
        {(loading || filtered.featured.length > 0) && (
          <div className="sec anim anim-3">
            <div className="sec-head">
              <div className="sec-label">
                <span className="sec-title">💎 Featured</span>
              </div>
            </div>
            {loading
              ? <div className="feat-wrap"><div className="sk sk-ft" /></div>
              : <div className="feat-wrap">
                  {filtered.featured.map((p) => <FeatCard key={p.id} p={p} onClick={handleClick} />)}
                </div>
            }
          </div>
        )}

        {/* ═══ NEARBY ═══ */}
        {(loading || filtered.nearby.length > 0) && (
          <div className="sec anim anim-4">
            <div className="sec-head">
              <div className="sec-label">
                <span className="sec-title">📍 Near You</span>
                {meta.nearbySource && (
                  <span className={`sec-chip${meta.nearbySource === "gps" ? " gn" : ""}`}>
                    {meta.nearbySource === "gps" ? "GPS" : meta.nearbySource}
                  </span>
                )}
              </div>
              <button className="see-all" onClick={() => navigate("/nearby")}>See all →</button>
            </div>
            {loading
              ? <SkelRow />
              : <div className="row">
                  {filtered.nearby.map((p, i) => (
                    <CardO key={p.id} p={p} priority={i === 0} onView={trackView} onClick={handleClick} />
                  ))}
                </div>
            }
          </div>
        )}

        <div className="divider" />

        {/* ═══ TRENDING ═══ */}
        <div className="sec anim anim-5">
          <div className="sec-head">
            <div className="sec-label">
              <span className="sec-title">🔥 Trending</span>
            </div>
            <button className="see-all" onClick={() => navigate("/trending")}>See all →</button>
          </div>
          {loading
            ? <SkelRow />
            : filtered.trending.length === 0
              ? <p className="inline-empty">Nothing trending yet</p>
              : <div className="row">
                  {filtered.trending.map((p, i) => (
                    <CardO key={p.id} p={p} rank={i} onView={trackView} onClick={handleClick} />
                  ))}
                </div>
          }
        </div>

        <div className="divider" />

        {/* ═══ CHEAP DEALS ═══ */}
        <div className="sec">
          <div className="sec-head">
            <div className="sec-label">
              <span className="sec-title">💸 Cheap Deals</span>
              <span className="sec-chip">Under ₦20k</span>
            </div>
          </div>
          {loading
            ? <SkelGrid />
            : filtered.deals.length === 0
              ? <p className="inline-empty">No deals in this category right now</p>
              : <>
                  <div className="grid2">
                    {filtered.deals.slice(0, dealsVis).map((p) => (
                      <CardT key={p.id} p={p} onView={trackView} onClick={handleClick} />
                    ))}
                  </div>
                  {dealsVis < filtered.deals.length && (
                    <button className="load-more" onClick={() => setDealsVis((v) => v + 6)}>
                      Show more deals
                    </button>
                  )}
                </>
          }
        </div>

        <div className="divider" />

        {/* ═══ LATEST ═══ */}
        <div className="sec">
          <div className="sec-head">
            <div className="sec-label">
              <span className="sec-title">🆕 Latest</span>
            </div>
            <button className="see-all" onClick={() => navigate("/latest")}>See all →</button>
          </div>
          {loading
            ? <SkelRow />
            : filtered.latest.length === 0
              ? <p className="inline-empty">No listings yet</p>
              : <>
                  <div className="row">
                    {filtered.latest.map((p, i) => (
                      <CardO key={p.id} p={p} priority={i === 0} onView={trackView} onClick={handleClick} />
                    ))}
                  </div>
                  <div ref={sentinelRef} style={{ height: 1 }} />
                  {loadingMore && <p className="loading-more">Loading more</p>}
                </>
          }
        </div>

      </div>{/* /pg */}

      {/* ═══ SELL FAB ═══ */}
      <button className="fab" onClick={() => navigate("/minimart/add")} aria-label="Sell a product">
        <span className="fab-ic">＋</span>
        Sell Now
      </button>

      <BottomNav />
    </>
  );
}
