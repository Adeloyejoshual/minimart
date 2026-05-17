import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import MasonryGrid from "../components/MasonryGrid";

const API_BASE = "https://minimart-ivrm.onrender.com";
const LIMIT = 20;

/* ─── Styles ─────────────────────────────────────────────────────────────────*/
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

  :root {
    --bg:      #0a0a0f;
    --surface: #12121a;
    --card:    #1a1a26;
    --border:  rgba(255,255,255,0.07);
    --accent:  #f97316;
    --text:    #f0ede8;
    --muted:   #7a7a8c;
    --online:  #34d399;
    --offline: #4b4b60;
    --r:       16px;
    --r-sm:    10px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .sp-root {
    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    min-height: 100vh;
    color: var(--text);
    padding-bottom: 80px;
  }

  /* ── Sticky mini-header ── */
  .sp-sticky {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: rgba(10,10,15,0.85);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    transform: translateY(-100%);
    transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
  }
  .sp-sticky.visible { transform: translateY(0); }
  .sp-sticky-avatar {
    width: 32px; height: 32px;
    border-radius: 10px;
    object-fit: cover;
  }
  .sp-sticky-name {
    font-family: 'Syne', sans-serif;
    font-size: 15px; font-weight: 700;
    flex: 1;
  }
  .sp-sticky-chat {
    font-size: 12px; font-weight: 600;
    background: var(--accent);
    color: #000;
    border: none;
    border-radius: 8px;
    padding: 6px 14px;
    cursor: pointer;
  }

  /* ── Hero ── */
  .sp-hero {
    position: relative;
    height: 210px;
    overflow: hidden;
    background: linear-gradient(135deg, #1a0a00 0%, #0d0d1a 60%, #000d1a 100%);
    background-size: cover;
    background-position: center;
  }
  .sp-hero-overlay {
    position: absolute; inset: 0;
    backdrop-filter: blur(0px);
    background: linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, #0a0a0f 100%);
  }
  .sp-hero-glow {
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 60% 80% at 20% 50%, rgba(249,115,22,0.2) 0%, transparent 70%),
      radial-gradient(ellipse 40% 60% at 80% 30%, rgba(251,146,60,0.1) 0%, transparent 70%);
    pointer-events: none;
  }

  /* ── Profile card ── */
  .sp-profile-card {
    position: relative;
    margin: -64px 16px 0;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r);
    padding: 20px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(249,115,22,0.07);
    animation: slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both;
    transition: transform 0.2s ease;
  }
  .sp-profile-card:hover { transform: translateY(-3px); }

  /* ── Avatar ── */
  .sp-avatar-row {
    display: flex;
    align-items: flex-end;
    gap: 14px;
    margin-bottom: 14px;
  }
  .sp-avatar-wrap {
    position: relative;
    flex-shrink: 0;
  }
  /* outer glow ring */
  .sp-avatar-wrap::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 22px;
    border: 1px solid rgba(249,115,22,0.3);
    pointer-events: none;
  }
  .sp-avatar {
    width: 76px; height: 76px;
    border-radius: 20px;
    object-fit: cover;
    border: 2px solid var(--border);
    background: var(--surface);
    box-shadow: 0 8px 25px rgba(0,0,0,0.6);
    display: block;
  }
  .sp-dot {
    position: absolute; bottom: 4px; right: 4px;
    width: 12px; height: 12px;
    border-radius: 50%;
    border: 2px solid var(--card);
  }
  .sp-dot.on  { background: var(--online);  box-shadow: 0 0 8px var(--online); }
  .sp-dot.off { background: var(--offline); }

  .sp-store-name {
    font-family: 'Syne', sans-serif;
    font-size: 24px; font-weight: 800;
    line-height: 1.1; letter-spacing: -0.5px;
  }
  .sp-badge {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 10px; font-weight: 600;
    color: var(--accent);
    background: rgba(249,115,22,0.12);
    border: 1px solid rgba(249,115,22,0.25);
    border-radius: 20px; padding: 3px 8px;
    margin-left: 7px; vertical-align: middle;
  }
  .sp-sub {
    font-size: 12px; color: var(--muted); margin-top: 4px;
  }

  /* ── Description ── */
  .sp-desc {
    font-size: 13.5px; color: var(--muted);
    line-height: 1.55; margin-bottom: 14px;
  }

  /* ── Chips ── */
  .sp-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
  .sp-chip {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 12px; font-weight: 500;
    color: var(--muted);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px; padding: 4px 10px;
  }
  .sp-chip.hi   { color: var(--accent); border-color: rgba(249,115,22,0.22); background: rgba(249,115,22,0.06); }
  .sp-chip.gold { color: #facc15;       border-color: rgba(250,204,21,0.4);  background: rgba(250,204,21,0.06); }

  /* ── Trust bar ── */
  .sp-trust-wrap { margin-bottom: 16px; }
  .sp-trust-label {
    display: flex; justify-content: space-between;
    font-size: 11px; color: var(--muted);
    margin-bottom: 5px;
  }
  .sp-trust-bar {
    height: 6px;
    background: var(--surface);
    border-radius: 10px; overflow: hidden;
  }
  .sp-trust-fill {
    height: 100%;
    background: linear-gradient(90deg, #34d399, #22c55e);
    border-radius: 10px;
    transition: width 0.8s cubic-bezier(0.16,1,0.3,1);
  }

  /* ── Action buttons ── */
  .sp-actions { display: flex; gap: 10px; }
  .sp-btn-primary {
    flex: 1;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    background: var(--accent);
    color: #000;
    border: none; border-radius: var(--r-sm);
    padding: 11px 10px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px; font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, transform 0.15s;
  }
  .sp-btn-primary:hover  { background: #fb923c; transform: translateY(-1px); }
  .sp-btn-primary:active { transform: translateY(0); }
  .sp-btn-secondary {
    flex: 1;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    padding: 11px 10px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px; font-weight: 500;
    cursor: pointer;
    transition: border-color 0.15s, transform 0.15s, background 0.15s;
  }
  .sp-btn-secondary:hover { border-color: rgba(249,115,22,0.4); background: rgba(249,115,22,0.05); transform: translateY(-1px); }
  .sp-btn-secondary.following {
    border-color: rgba(249,115,22,0.4);
    color: var(--accent);
    background: rgba(249,115,22,0.06);
  }

  /* ── Stats ── */
  .sp-stats {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 8px; margin: 12px 16px 0;
    animation: slideUp 0.5s 0.08s cubic-bezier(0.16,1,0.3,1) both;
  }
  .sp-stat {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    padding: 14px 6px; text-align: center;
    cursor: pointer;
    transition: border-color 0.2s, transform 0.2s, background 0.2s;
  }
  .sp-stat:hover       { border-color: rgba(249,115,22,0.3); transform: translateY(-2px); }
  .sp-stat.active-tab { border-color: var(--accent); background: rgba(249,115,22,0.06); }
  .sp-stat-icon { font-size: 14px; margin-bottom: 5px; }
  .sp-stat-val {
    font-family: 'Syne', sans-serif;
    font-size: 16px; font-weight: 800;
    color: var(--text); line-height: 1; margin-bottom: 4px;
  }
  .sp-stat-lbl {
    font-size: 10px; font-weight: 500;
    color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.7px;
  }

  /* ── Section header ── */
  .sp-sec-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 16px 12px;
    animation: slideUp 0.5s 0.16s cubic-bezier(0.16,1,0.3,1) both;
  }
  .sp-sec-title {
    font-family: 'Syne', sans-serif;
    font-size: 18px; font-weight: 700;
  }
  .sp-count {
    font-size: 12px; font-weight: 600;
    color: var(--accent);
    background: rgba(249,115,22,0.1);
    border: 1px solid rgba(249,115,22,0.2);
    border-radius: 20px; padding: 3px 10px;
  }

  /* ── Products ── */
  .sp-products {
    padding: 0 16px;
    animation: slideUp 0.5s 0.22s cubic-bezier(0.16,1,0.3,1) both;
  }

  /* ── Empty ── */
  .sp-empty {
    text-align: center; padding: 60px 20px;
    color: var(--muted); font-size: 14px;
  }
  .sp-empty-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.4; }

  /* ── Load states ── */
  .sp-loading-more {
    display: flex; align-items: center; justify-content: center;
    gap: 8px; padding: 20px;
    color: var(--muted); font-size: 13px;
  }
  .sp-spinner {
    width: 16px; height: 16px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  .sp-end {
    text-align: center; padding: 24px;
    font-size: 12px; color: var(--offline); letter-spacing: 0.5px;
  }
  .sp-more-err {
    margin: 8px 0;
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: var(--r-sm);
    padding: 12px 16px;
    display: flex; align-items: center;
    justify-content: space-between; gap: 12px;
    font-size: 13px; color: #f87171;
  }
  .sp-retry {
    font-size: 12px; font-weight: 600;
    color: var(--accent);
    background: rgba(249,115,22,0.1);
    border: 1px solid rgba(249,115,22,0.25);
    border-radius: 20px; padding: 4px 12px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .sp-retry:hover { background: rgba(249,115,22,0.2); }

  /* ── Full-page states ── */
  .sp-center {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    min-height: 60vh; gap: 14px;
    color: var(--muted); font-size: 14px;
  }

  /* ── Skeleton shimmer ── */
  .skel {
    background: linear-gradient(90deg, var(--card) 25%, var(--surface) 50%, var(--card) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: var(--r-sm);
  }

  /* ── Keyframes ── */
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes shimmer {
    0%   { background-position:  200% 0; }
    100% { background-position: -200% 0; }
  }
`;

/* ─── Skeleton ─────────────────────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="sp-root">
      <div className="sp-hero" />
      <div className="sp-profile-card" style={{ margin: "-64px 16px 0" }}>
        <div className="sp-avatar-row">
          <div className="skel" style={{ width: 76, height: 76, borderRadius: 20 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="skel" style={{ height: 24, width: "65%" }} />
            <div className="skel" style={{ height: 13, width: "40%" }} />
          </div>
        </div>
        <div className="skel" style={{ height: 40, marginBottom: 14 }} />
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[80, 90, 70].map((w, i) => (
            <div key={i} className="skel" style={{ height: 28, width: w, borderRadius: 20 }} />
          ))}
        </div>
        <div className="skel" style={{ height: 6, borderRadius: 10, marginBottom: 16 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <div className="skel" style={{ flex: 1, height: 42, borderRadius: 10 }} />
          <div className="skel" style={{ flex: 1, height: 42, borderRadius: 10 }} />
        </div>
      </div>
      <div className="sp-stats" style={{ marginTop: 12 }}>
        {[0,1,2,3].map(i => <div key={i} className="skel" style={{ height: 78 }} />)}
      </div>
    </div>
  );
}

/* ─── Stat box ─────────────────────────────────────────────────────────────── */
function Stat({ value, label, icon, active, onClick }) {
  const fmt = n => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n;
  return (
    <div className={`sp-stat${active ? " active-tab" : ""}`} onClick={onClick}>
      <div className="sp-stat-icon">{icon}</div>
      <div className="sp-stat-val">{fmt(value)}</div>
      <div className="sp-stat-lbl">{label}</div>
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────────────────── */
export default function SellerProfile() {
  const { id } = useParams();

  const [seller, setSeller]           = useState(null);
  const [products, setProducts]       = useState([]);
  const [stats, setStats]             = useState(null);
  const [cursor, setCursor]           = useState(null);
  const [hasMore, setHasMore]         = useState(false);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState(null);
  const [moreError, setMoreError]     = useState(null);
  const [following, setFollowing]     = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [scrolled, setScrolled]       = useState(false);
  const [activeTab, setActiveTab]     = useState("products");

  const sentinelRef  = useRef(null);
  const productsRef  = useRef(null);

  /* scroll watcher for sticky header */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 220);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* initial fetch — new unified response shape */
  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        const { data } = await axios.get(`${API_BASE}/api/seller/${id}`);
        setSeller(data.data);
        setStats(data.stats);
        const initial = data.products ?? [];
        setProducts(initial);
        setHasMore(data.pagination?.hasMore ?? initial.length === LIMIT);
        // seed cursor from last item's created_at
        if (initial.length > 0) {
          setCursor(initial[initial.length - 1].created_at);
        }
      } catch {
        setError("Could not load this seller. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  /* cursor-based load more */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true); setMoreError(null);
    try {
      const { data } = await axios.get(
        `${API_BASE}/api/seller/${id}/products?cursor=${encodeURIComponent(cursor)}&limit=${LIMIT}`
      );
      const incoming = data.products ?? [];
      setProducts(p => [...p, ...incoming]);
      setHasMore(data.pagination?.hasMore ?? false);
      if (incoming.length > 0) {
        setCursor(incoming[incoming.length - 1].created_at);
      }
    } catch {
      setMoreError("Failed to load more products.");
    } finally {
      setLoadingMore(false);
    }
  }, [id, cursor, hasMore, loadingMore]);

  /* intersection observer */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) loadMore(); },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  /* follow toggle */
  const toggleFollow = async () => {
    setFollowLoading(true);
    try {
      if (following) {
        await axios.delete(`${API_BASE}/api/seller/${id}/follow`);
      } else {
        await axios.post(`${API_BASE}/api/seller/${id}/follow`);
      }
      setFollowing(f => !f);
    } catch {
      /* silently fail — could add toast here */
    } finally {
      setFollowLoading(false);
    }
  };

  /* stat tab click — scroll to products section */
  const handleStatClick = (tab) => {
    setActiveTab(tab);
    if (tab === "products") {
      productsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  /* ── Guards ── */
  if (loading) return <><style>{css}</style><Skeleton /></>;

  if (error) return (
    <><style>{css}</style>
    <div className="sp-root">
      <TopNav />
      <div className="sp-center"><div style={{ fontSize: 36 }}>⚠️</div><p>{error}</p></div>
      <BottomNav />
    </div></>
  );

  if (!seller) return (
    <><style>{css}</style>
    <div className="sp-root">
      <TopNav />
      <div className="sp-center"><p>Seller not found.</p></div>
      <BottomNav />
    </div></>
  );

  const year      = new Date(seller.created_at).getFullYear();
  const isGold    = (seller.rating ?? 0) > 4.5;
  const trustPct  = Math.min(100, Math.max(0, Number(seller.trust_score) || 0));
  const avatar    = seller.store_logo || seller.profile_image || "/default.png";

  return (
    <><style>{css}</style>
    <div className="sp-root">

      {/* ── Sticky mini-header ── */}
      <div className={`sp-sticky${scrolled ? " visible" : ""}`}>
        <img className="sp-sticky-avatar" src={avatar} alt="" loading="lazy" />
        <span className="sp-sticky-name">{seller.store_name || seller.name}</span>
        <button className="sp-sticky-chat" onClick={() => {}}>Chat</button>
      </div>

      <TopNav />

      {/* ── Hero — uses real banner if available ── */}
      <div
        className="sp-hero"
        style={seller.banner
          ? { backgroundImage: `url(${seller.banner})`, backgroundSize: "cover", backgroundPosition: "center" }
          : undefined
        }
      >
        <div className="sp-hero-glow" />
        <div className="sp-hero-overlay" />
      </div>

      {/* ── Profile card ── */}
      <div className="sp-profile-card">

        {/* Avatar + name */}
        <div className="sp-avatar-row">
          <div className="sp-avatar-wrap">
            <img
              className="sp-avatar"
              src={avatar}
              alt={seller.store_name || seller.name}
              loading="lazy"
            />
            <span className={`sp-dot ${seller.is_online ? "on" : "off"}`} />
          </div>
          <div>
            <div className="sp-store-name">
              {seller.store_name || seller.name}
              {seller.verified && <span className="sp-badge">✔ Verified</span>}
            </div>
            <div className="sp-sub">
              {seller.city || "Unknown location"} •{" "}
              {seller.is_online ? "Active now" : "Last seen recently"}
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="sp-desc">
          {seller.store_description || "No description provided."}
        </p>

        {/* Chips */}
        <div className="sp-chips">
          <span className={`sp-chip ${isGold ? "gold" : "hi"}`}>
            ⭐ {seller.rating ?? 0} rating
          </span>
          <span className="sp-chip">📅 Since {year}</span>
          <span className="sp-chip">🛒 {seller.total_sales ?? 0} sales</span>
        </div>

        {/* Trust bar */}
        <div className="sp-trust-wrap">
          <div className="sp-trust-label">
            <span>Trust Score</span>
            <span style={{ color: trustPct > 70 ? "#34d399" : "var(--muted)" }}>
              {trustPct}%
            </span>
          </div>
          <div className="sp-trust-bar">
            <div className="sp-trust-fill" style={{ width: `${trustPct}%` }} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="sp-actions">
          <button className="sp-btn-primary" onClick={() => {}}>
            💬 Chat
          </button>
          <button
            className={`sp-btn-secondary${following ? " following" : ""}`}
            onClick={toggleFollow}
            disabled={followLoading}
          >
            {following ? "✓ Following" : "+ Follow"}
          </button>
        </div>
      </div>

      {/* ── Stats (clickable tabs) ── */}
      <div className="sp-stats">
        <Stat
          value={stats?.total_products ?? 0}
          label="Products" icon="📦"
          active={activeTab === "products"}
          onClick={() => handleStatClick("products")}
        />
        <Stat
          value={stats?.total_views ?? 0}
          label="Views" icon="👁"
          active={activeTab === "views"}
          onClick={() => handleStatClick("views")}
        />
        <Stat
          value={seller.total_sales ?? 0}
          label="Sales" icon="🛒"
          active={activeTab === "sales"}
          onClick={() => handleStatClick("sales")}
        />
        <Stat
          value={stats?.total_clicks ?? 0}
          label="Clicks" icon="⚡"
          active={activeTab === "clicks"}
          onClick={() => handleStatClick("clicks")}
        />
      </div>

      {/* ── Products section ── */}
      <div ref={productsRef}>
        <div className="sp-sec-head">
          <span className="sp-sec-title">Products</span>
          {stats?.total_products > 0 && (
            <span className="sp-count">{stats.total_products}</span>
          )}
        </div>

        <div className="sp-products">
          {products.length === 0 ? (
            <div className="sp-empty">
              <div className="sp-empty-icon">📦</div>
              <p>No active products yet.</p>
            </div>
          ) : (
            <MasonryGrid products={products} onView={() => {}} onClick={() => {}} />
          )}

          {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}

          {loadingMore && (
            <div className="sp-loading-more">
              <div className="sp-spinner" /> Loading more…
            </div>
          )}

          {moreError && (
            <div className="sp-more-err">
              <span>{moreError}</span>
              <button className="sp-retry" onClick={loadMore}>Retry</button>
            </div>
          )}

          {!hasMore && products.length > 0 && (
            <div className="sp-end">· All products loaded ·</div>
          )}
        </div>
      </div>

      <BottomNav />
    </div></>
  );
}
