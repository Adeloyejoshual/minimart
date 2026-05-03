/**
 * Homepage.jsx — Minimart
 */

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  memo,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const API = import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";
const PH   = "https://placehold.co/600x500/e8e4dc/b0a89e?text=Minimart";
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

const split = (products) => {
  // For debugging, show latest/featured freely; relax filters
  const latest  = [...products];
  const featured = latest.filter((p) => p.is_promoted).slice(0, 3);
  const nearby   = latest.slice(0, 10);
  const trending = latest.slice(0, 14);
  const deals    = latest.filter((p) => p.price <= 20_000);

  return { featured, nearby, trending, deals, latest };
};

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

  .pg { padding-bottom:92px; }

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

  .hero { background:var(--ink); padding:20px 18px 0; position:relative; overflow:hidden; }
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

  .row { display:flex; gap:12px; padding:3px 16px 10px; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; }
  .row::-webkit-scrollbar { display:none; }
  .row > * { scroll-snap-align:start; }

  .grid2 { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; padding:3px 16px 10px; }

  .co { width:158px; border-radius:var(--r2); overflow:hidden; cursor:pointer; flex-shrink:0; position:relative; box-shadow:var(--s1); background:var(--bd); transition:transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s; }
  .co:hover { transform:translateY(-4px) scale(1.01); box-shadow:var(--s3); }
  .co:active { transform:scale(.96); }
  .co-img { width:100%; height:200px; object-fit:cover; display:block; background:var(--bd); }
  .co-grad { position:absolute; bottom:0; left:0; right:0; background:linear-gradient(to top, rgba(14,10,6,.92) 0%, rgba(14,10,6,.60) 45%, transparent 100%); padding:36px 10px 10px; }
  .co-name { font-size:12.5px; font-weight:600; color:#fff; line-height:1.3; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; margin-bottom:5px; }
  .co-price { font-family:var(--fd); font-size:15px; font-weight:700; color:var(--o2); }
  .co-foot { display:flex; align-items:center; justify-content:space-between; margin-top:4px; }
  .co-loc { font-size:10px; color:rgba(255,255,255,.55); }
  .bd { position:absolute; top:8px; left:8px; z-index:3; font-size:8.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; border-radius:5px; padding:3px 7px; }
  .bd-feat { background:var(--gn); color:#fff; }
  .bd-new  { background:var(--o);  color:#fff; }
  .bd-hot  { background:#DC2626; color:#fff; }
  .bd-trnd { background:#7C3AED; color:#fff; }
  .rank { position:absolute; top:8px; right:9px; z-index:3; font-family:var(--fd); font-size:24px; font-weight:700; color:rgba(255,255,255,.22); line-height:1; text-shadow:0 2px 8px rgba(0,0,0,.3); }

  .ct { border-radius:var(--r2); overflow:hidden; position:relative; cursor:pointer; background:var(--wh); border:1.5px solid var(--bd); box-shadow:var(--s1); transition:transform .18s cubic-bezier(.34,1.56,.64,1),