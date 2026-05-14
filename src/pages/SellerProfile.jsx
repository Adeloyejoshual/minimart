import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import TopNav from "../../components/TopNav";
import BottomNav from "../../components/BottomNav";
import MasonryGrid from "../../components/MasonryGrid";

const API_BASE = "https://minimart-ivrm.onrender.com";
const LIMIT = 20;

/* ─── Design tokens & styles ──────────────────────────────────────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

  :root {
    --bg:       #0a0a0f;
    --surface:  #12121a;
    --card:     #1a1a26;
    --border:   rgba(255,255,255,0.07);
    --accent:   #f97316;
    --text:     #f0ede8;
    --muted:    #7a7a8c;
    --online:   #34d399;
    --offline:  #4b4b60;
    --r:        16px;
    --r-sm:     10px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .sp-root {
    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    min-height: 100vh;
    color: var(--text);
    padding-bottom: 80px;
  }

  /* ── Hero ── */
  .sp-hero {
    position: relative;
    height: 200px;
    overflow: hidden;
    background: linear-gradient(135deg, #1a0a00 0%, #0d0d1a 50%, #000d1a 100%);
  }
  .sp-hero::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 60% 80% at 20% 50%, rgba(249,115,22,0.18) 0%, transparent 70%),
      radial-gradient(ellipse 40% 60% at 80% 30%, rgba(251,146,60,0.10) 0%, transparent 70%);
  }
  .sp-hero-noise {
    position: absolute; inset: 0;
    opacity: 0.04;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px;
  }

  /* ── Profile card ── */
  .sp-profile-card {
    position: relative;
    margin: -60px 16px 0;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r);
    padding: 20px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(249,115,22,0.06);
    animation: slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both;
  }

  .sp-avatar-row {
    display: flex;
    align-items: flex-end;
    gap: 14px;
    margin-bottom: 14px;
  }
  .sp-avatar-wrap { position: relative; flex-shrink: 0; }
  .sp-avatar {
    width: 76px; height: 76px;
    border-radius: 20px;
    object-fit: cover;
    border: 2px solid var(--border);
    background: var(--surface);
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
    font-size: 22px; font-weight: 800;
    line-height: 1.1; letter-spacing: -0.3px;
  }
  .sp-badge {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 11px; font-weight: 600;
    color: var(--accent);
    background: rgba(249,115,22,0.12);
    border: 1px solid rgba(249,115,22,0.25);
    border-radius: 20px; padding: 2px 8px;
    margin-left: 7px; vertical-align: middle;
    letter-spacing: 0.3px;
  }
  .sp-sub { font-size: 12px; color: var(--muted); margin-top: 3px; }

  .sp-desc {
    font-size: 13.5px; color: var(--muted);
    line-height: 1.55; margin-bottom: 14px;
  }

  .sp-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .sp-chip {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 12px; font-weight: 500;
    color: var(--muted);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px; padding: 4px 10px;
  }
  .sp-chip.hi { color: var(--accent); border-color: rgba(249,115,22,0.22); background: rgba(249,115,22,0.06); }

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
    transition: border-color 0.2s, transform 0.2s;
    cursor: default;
  }
  .sp-stat:hover { border-color: rgba(249,115,22,0.3); transform: translateY(-2px); }
  .sp-stat-val {
    font-family: 'Syne', sans-serif;
    font-size: 17px; font-weight: 800;
    color: var(--text); line-height: 1; margin-bottom: 5px;
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
    font-size: 12px; color: var(--offline);
    letter-spacing: 0.5px;
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
    cursor: pointer; white-space: nowrap;
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

  /* ── Skeleton ── */
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
  @keyframes spin { to { transform: rotate(360deg); } }
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
      <div className="sp-profile-card">
        <div className="sp-avatar-row">
          <div className="skel" style={{ width: 76, height: 76, borderRadius: 20 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="skel" style={{ height: 22, width: "60%" }} />
            <div className="skel" style={{ height: 14, width: "35%" }} />
          </div>
        </div>
        <div className="skel" style={{ height: 40, marginBottom: 14 }} />
        <div style={{ display: "flex", gap: 6 }}>
          {[80, 90, 70].map((w, i) => (
            <div key={i} className="skel" style={{ height: 28, width: w, borderRadius: 20 }} />
          ))}
        </div>
      </div>
      <div className="sp-stats">
        {[0,1,2,3].map(i => <div key={i} className="skel" style={{ height: 68 }} />)}
      </div>
    </div>
  );
}

/* ─── Stat box ─────────────────────────────────────────────────────────────── */
function Stat({ value, label }) {
  const fmt = n => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n;
  return (
    <div className="sp-stat">
      <div className="sp-stat-val">{fmt(value)}</div>
      <div className="sp-stat-lbl">{label}</div>
    </div>
  );
}

/* ─── Main ─────────────────────────────────────────────────────────────────── */
export default function SellerProfile() {
  const { id } = useParams();

  const [seller, setSeller]           = useState(null);
  const [products, setProducts]       = useState([]);
  const [stats, setStats]             = useState(null);
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(false);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState(null);
  const [moreError, setMoreError]     = useState(null);
  const sentinelRef = useRef(null);

  /* initial fetch */
  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        const { data } = await axios.get(`${API_BASE}/api/seller/${id}`);
        setSeller(data.seller);
        setStats(data.stats);
        const initial = data.products ?? [];
        setProducts(initial);
        setHasMore(initial.length === LIMIT);
        setPage(1);
      } catch {
        setError("Could not load this seller. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  /* load more */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true); setMoreError(null);
    try {
      const next = page + 1;
      const { data } = await axios.get(
        `${API_BASE}/api/seller/${id}/products?page=${next}&limit=${LIMIT}`
      );
      const incoming = data.products ?? [];
      setProducts(p => [...p, ...incoming]);
      setPage(next);
      setHasMore(data.hasMore ?? incoming.length === LIMIT);
    } catch {
      setMoreError("Failed to load more products.");
    } finally {
      setLoadingMore(false);
    }
  }, [id, page, hasMore, loadingMore]);

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

  const year = seller ? new Date(seller.created_at).getFullYear() : "";

  /* ── Render ── */
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

  return (
    <><style>{css}</style>
    <div className="sp-root">
      <TopNav />

      {/* Hero */}
      <div className="sp-hero"><div className="sp-hero-noise" /></div>

      {/* Profile card */}
      <div className="sp-profile-card">
        <div className="sp-avatar-row">
          <div className="sp-avatar-wrap">
            <img
              className="sp-avatar"
              src={seller.store_logo || seller.profile_image || "/default.png"}
              alt={seller.store_name || seller.name}
            />
            <span className={`sp-dot ${seller.is_online ? "on" : "off"}`} />
          </div>
          <div>
            <div className="sp-store-name">
              {seller.store_name || seller.name}
              {seller.verified && <span className="sp-badge">✔ Verified</span>}
            </div>
            <div className="sp-sub">{seller.is_online ? "Online now" : "Offline"}</div>
          </div>
        </div>

        <p className="sp-desc">
          {seller.store_description || "No description provided."}
        </p>

        <div className="sp-chips">
          <span className="sp-chip hi">⭐ {seller.rating ?? 0} rating</span>
          <span className="sp-chip">🛡 Trust {seller.trust_score ?? "—"}</span>
          <span className="sp-chip">📅 Since {year}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="sp-stats">
        <Stat value={stats?.total_products ?? 0} label="Products" />
        <Stat value={stats?.total_views    ?? 0} label="Views"    />
        <Stat value={seller.total_sales    ?? 0} label="Sales"    />
        <Stat value={stats?.total_clicks   ?? 0} label="Clicks"   />
      </div>

      {/* Section header */}
      <div className="sp-sec-head">
        <span className="sp-sec-title">Products</span>
        {stats?.total_products > 0 && (
          <span className="sp-count">{stats.total_products}</span>
        )}
      </div>

      {/* Products */}
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

      <BottomNav />
    </div></>
  );
}
