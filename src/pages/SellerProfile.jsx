import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

/* ─────────────────────────────────────────────
   Inline styles / design tokens
   (drop this file's <style> block into your
   global CSS if you prefer – everything is
   namespaced with .sp-*)
───────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  :root {
    --sp-bg:          #f5f4f0;
    --sp-surface:     #ffffff;
    --sp-brand:       #1a1a2e;
    --sp-brand-mid:   #16213e;
    --sp-accent:      #e85a2a;
    --sp-accent-soft: #fff0eb;
    --sp-text:        #1a1a2e;
    --sp-muted:       #6b6b80;
    --sp-border:      #e4e4ec;
    --sp-gold:        #f5a623;
    --sp-radius:      14px;
    --sp-shadow:      0 2px 16px rgba(26,26,46,0.08);
    --sp-shadow-lg:   0 8px 40px rgba(26,26,46,0.14);
  }

  .sp-root { font-family: 'Sora', sans-serif; background: var(--sp-bg); min-height: 100vh; color: var(--sp-text); }

  /* ── HERO ─────────────────────────────────── */
  .sp-hero {
    background: var(--sp-brand);
    position: relative;
    overflow: hidden;
    padding: 56px 0 0;
  }
  .sp-hero::before {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(ellipse 80% 60% at 70% 50%, #2a2a5e 0%, transparent 70%),
                repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 32px);
  }
  .sp-hero-inner {
    position: relative;
    max-width: 1140px; margin: 0 auto; padding: 0 32px;
    display: flex; align-items: flex-end; gap: 32px;
    padding-bottom: 0;
  }
  .sp-avatar-wrap {
    flex-shrink: 0;
    width: 108px; height: 108px;
    border-radius: 50%;
    border: 3px solid rgba(255,255,255,0.18);
    background: linear-gradient(135deg, var(--sp-accent), #c0392b);
    display: flex; align-items: center; justify-content: center;
    font-size: 2.6rem; font-weight: 700; color: #fff;
    box-shadow: 0 4px 24px rgba(232,90,42,0.35);
    overflow: hidden;
    margin-bottom: -28px;
    position: relative; z-index: 2;
    transition: transform 0.3s ease;
  }
  .sp-avatar-wrap:hover { transform: scale(1.04); }
  .sp-avatar-wrap img { width: 100%; height: 100%; object-fit: cover; }
  .sp-hero-text { padding-bottom: 32px; color: #fff; }
  .sp-hero-name { font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
  .sp-hero-sub { font-size: 0.85rem; color: rgba(255,255,255,0.55); margin-top: 6px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .sp-hero-dot { width: 3px; height: 3px; border-radius: 50%; background: rgba(255,255,255,0.35); display: inline-block; }
  .sp-hero-tabs {
    max-width: 1140px; margin: 0 auto; padding: 0 32px;
    display: flex; gap: 2px; position: relative; z-index: 1; margin-top: 28px;
  }
  .sp-tab {
    padding: 12px 22px; font-size: 0.82rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
    color: rgba(255,255,255,0.45); cursor: pointer; border: none; background: none;
    border-bottom: 2px solid transparent; transition: all 0.2s;
  }
  .sp-tab.active { color: #fff; border-bottom-color: var(--sp-accent); }
  .sp-tab:hover:not(.active) { color: rgba(255,255,255,0.75); }

  /* ── BODY ─────────────────────────────────── */
  .sp-body { max-width: 1140px; margin: 0 auto; padding: 40px 32px 80px; }
  .sp-layout { display: grid; grid-template-columns: 280px 1fr; gap: 28px; }
  @media (max-width: 900px) { .sp-layout { grid-template-columns: 1fr; } }

  /* ── CARDS ────────────────────────────────── */
  .sp-card {
    background: var(--sp-surface); border-radius: var(--sp-radius);
    border: 1px solid var(--sp-border); box-shadow: var(--sp-shadow);
    overflow: hidden;
  }
  .sp-card + .sp-card { margin-top: 16px; }
  .sp-card-head {
    padding: 18px 20px 14px;
    border-bottom: 1px solid var(--sp-border);
    display: flex; align-items: center; gap: 10px;
  }
  .sp-card-head h3 { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--sp-muted); margin: 0; }
  .sp-card-body { padding: 18px 20px; }

  /* ── STAT ROWS ────────────────────────────── */
  .sp-stat-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 0; border-bottom: 1px solid var(--sp-border);
  }
  .sp-stat-row:last-child { border-bottom: none; }
  .sp-stat-label { font-size: 0.82rem; color: var(--sp-muted); }
  .sp-stat-value { font-size: 0.92rem; font-weight: 700; font-family: 'DM Mono', monospace; }

  /* ── BIG STAT BLOCKS ──────────────────────── */
  .sp-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--sp-border); }
  .sp-stat-block { background: var(--sp-surface); padding: 20px 18px; }
  .sp-stat-block-num { font-size: 1.6rem; font-weight: 700; font-family: 'DM Mono', monospace; color: var(--sp-text); }
  .sp-stat-block-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--sp-muted); margin-top: 3px; }

  /* ── RATING STARS ─────────────────────────── */
  .sp-stars { display: inline-flex; gap: 2px; }
  .sp-star { color: #ddd; font-size: 0.85rem; }
  .sp-star.lit { color: var(--sp-gold); }
  .sp-rating-row { display: flex; align-items: center; gap: 8px; }
  .sp-rating-num { font-size: 1.1rem; font-weight: 700; font-family: 'DM Mono', monospace; }
  .sp-rating-count { font-size: 0.78rem; color: var(--sp-muted); }

  /* ── CONTACT LINKS ────────────────────────── */
  .sp-contact-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--sp-border); }
  .sp-contact-row:last-child { border-bottom: none; }
  .sp-contact-icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; }
  .sp-contact-icon.phone { background: #e8f5e9; color: #2e7d32; }
  .sp-contact-icon.wa { background: #e8f5e9; color: #25d366; }
  .sp-contact-label { font-size: 0.8rem; color: var(--sp-muted); line-height: 1; }
  .sp-contact-val { font-size: 0.88rem; font-weight: 500; margin-top: 2px; }
  .sp-contact-val a { color: var(--sp-accent); text-decoration: none; }
  .sp-contact-val a:hover { text-decoration: underline; }

  /* ── VERIFIED BADGE ───────────────────────── */
  .sp-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 600;
  }
  .sp-badge.verified { background: #e3f2fd; color: #1565c0; }
  .sp-badge.online { background: #e8f5e9; color: #2e7d32; }

  /* ── PRODUCTS SECTION ─────────────────────── */
  .sp-section-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 20px; }
  .sp-section-title { font-size: 1.3rem; font-weight: 700; letter-spacing: -0.01em; }
  .sp-section-sub { font-size: 0.8rem; color: var(--sp-muted); margin-top: 2px; }
  .sp-view-all { font-size: 0.8rem; font-weight: 600; color: var(--sp-accent); text-decoration: none; letter-spacing: 0.03em; }
  .sp-view-all:hover { text-decoration: underline; }

  /* ── PRODUCT GRID ─────────────────────────── */
  .sp-product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
  .sp-product-link { text-decoration: none; color: inherit; display: block; }
  .sp-product-card {
    background: var(--sp-surface); border-radius: var(--sp-radius);
    border: 1px solid var(--sp-border); overflow: hidden;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .sp-product-card:hover { transform: translateY(-3px); box-shadow: var(--sp-shadow-lg); }
  .sp-product-img {
    width: 100%; aspect-ratio: 4/3; object-fit: cover;
    background: #f0f0f0; display: block;
  }
  .sp-product-info { padding: 12px 14px 14px; }
  .sp-product-title {
    font-size: 0.85rem; font-weight: 600; color: var(--sp-text);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    line-height: 1.35; margin-bottom: 8px;
  }
  .sp-product-price { font-size: 1rem; font-weight: 700; color: var(--sp-accent); font-family: 'DM Mono', monospace; }
  .sp-product-location { font-size: 0.72rem; color: var(--sp-muted); margin-top: 4px; display: flex; align-items: center; gap: 3px; }

  /* ── EMPTY STATE ──────────────────────────── */
  .sp-empty {
    background: var(--sp-surface); border: 1px dashed var(--sp-border);
    border-radius: var(--sp-radius); text-align: center; padding: 60px 30px;
  }
  .sp-empty-icon { font-size: 2.5rem; margin-bottom: 12px; opacity: 0.5; }
  .sp-empty-text { font-size: 0.9rem; color: var(--sp-muted); }

  /* ── SKELETON ─────────────────────────────── */
  @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
  .sp-skel {
    background: linear-gradient(90deg, #ebebeb 25%, #f5f5f5 50%, #ebebeb 75%);
    background-size: 600px 100%; animation: shimmer 1.4s infinite linear;
    border-radius: 8px;
  }
  .sp-skel-circle { border-radius: 50%; }

  /* ── ERROR ────────────────────────────────── */
  .sp-error { text-align: center; padding: 80px 30px; }
  .sp-error-code { font-size: 4rem; font-weight: 700; color: var(--sp-border); font-family: 'DM Mono', monospace; }
  .sp-error-msg { font-size: 1rem; color: var(--sp-muted); margin-bottom: 24px; }
  .sp-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 11px 22px; background: var(--sp-brand); color: #fff;
    border-radius: 30px; font-size: 0.85rem; font-weight: 600;
    text-decoration: none; transition: opacity 0.2s;
  }
  .sp-btn:hover { opacity: 0.85; }

  /* ── FOOTER ───────────────────────────────── */
  .sp-footer { border-top: 1px solid var(--sp-border); margin-top: 64px; padding-top: 48px; }
  .sp-footer-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 32px; }
  .sp-footer-col h4 { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--sp-text); margin: 0 0 14px; }
  .sp-footer-col ul { list-style: none; padding: 0; margin: 0; }
  .sp-footer-col li + li { margin-top: 8px; }
  .sp-footer-col a { font-size: 0.83rem; color: var(--sp-muted); text-decoration: none; transition: color 0.2s; }
  .sp-footer-col a:hover { color: var(--sp-accent); }
  .sp-footer-bottom { margin-top: 36px; padding-top: 20px; border-top: 1px solid var(--sp-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
  .sp-footer-copy { font-size: 0.75rem; color: var(--sp-muted); }
  .sp-social-links { display: flex; gap: 12px; }
  .sp-social-links a { font-size: 0.78rem; color: var(--sp-muted); text-decoration: none; font-weight: 500; }
  .sp-social-links a:hover { color: var(--sp-accent); }
`;

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function Stars({ rating = 0 }) {
  const full = Math.round(rating);
  return (
    <span className="sp-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`sp-star${i <= full ? " lit" : ""}`}>★</span>
      ))}
    </span>
  );
}

function formatNaira(num) {
  return `₦${Number(num || 0).toLocaleString("en-NG")}`;
}

function initials(seller) {
  if (seller?.name) return seller.name.charAt(0).toUpperCase();
  if (seller?.email) return seller.email.charAt(0).toUpperCase();
  return "S";
}

/* ─────────────────────────────────────────────
   Loading skeleton
───────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="sp-root">
      {/* hero */}
      <div style={{ background: "#1a1a2e", padding: "56px 0 40px" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 32px", display: "flex", gap: 24, alignItems: "flex-end" }}>
          <div className="sp-skel sp-skel-circle" style={{ width: 108, height: 108, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="sp-skel" style={{ height: 28, width: 220, marginBottom: 10 }} />
            <div className="sp-skel" style={{ height: 14, width: 160 }} />
          </div>
        </div>
      </div>
      {/* body */}
      <div className="sp-body">
        <div className="sp-layout">
          <div>
            <div className="sp-skel" style={{ height: 220, borderRadius: 14 }} />
          </div>
          <div>
            <div className="sp-skel" style={{ height: 28, width: 200, marginBottom: 20 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <div className="sp-skel" style={{ height: 160, borderRadius: 14, marginBottom: 10 }} />
                  <div className="sp-skel" style={{ height: 14, width: "80%", marginBottom: 6 }} />
                  <div className="sp-skel" style={{ height: 14, width: "50%" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main component
───────────────────────────────────────────── */
const SellerProfile = () => {
  const { id } = useParams();
  const [seller, setSeller]   = useState(null);
  const [stats, setStats]     = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!id) {
      setError("Seller ID is missing.");
      setLoading(false);
      return;
    }

    const fetchSeller = async () => {
      try {
        setLoading(true);
        setError(null);

        const [sellerRes, statsRes, productsRes] = await Promise.all([
          fetch(`/api/seller/${id}`),
          fetch(`/api/seller/${id}/stats`),
          fetch(`/api/seller/${id}/products?limit=12`),
        ]);

        if (!sellerRes.ok)   throw new Error("Seller not found");
        if (!statsRes.ok)    throw new Error("Failed to load seller stats");
        if (!productsRes.ok) throw new Error("Failed to load seller products");

        const [sellerData, statsData, productsData] = await Promise.all([
          sellerRes.json(),
          statsRes.json(),
          productsRes.json(),
        ]);

        setSeller(sellerData);
        setStats(statsData);
        setProducts(productsData.products || []);
      } catch (err) {
        setError(err.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    };

    fetchSeller();
  }, [id]);

  /* ── Guards ──────────────────────────────── */
  if (loading) return (
    <>
      <style>{CSS}</style>
      <Skeleton />
    </>
  );

  if (error) return (
    <>
      <style>{CSS}</style>
      <div className="sp-root">
        <div className="sp-error">
          <div className="sp-error-code">404</div>
          <p className="sp-error-msg">{error}</p>
          <Link to="/" className="sp-btn">← Back to Marketplace</Link>
        </div>
      </div>
    </>
  );

  const memberSince = seller.created_at
    ? new Date(seller.created_at).toLocaleDateString("en-NG", { month: "long", year: "numeric" })
    : "—";

  const avgRating = Number(stats?.avg_rating || 0);

  return (
    <>
      <style>{CSS}</style>
      <div className="sp-root">

        {/* ── HERO ───────────────────────────── */}
        <header className="sp-hero">
          <div className="sp-hero-inner">
            <div className="sp-avatar-wrap">
              {seller.avatar
                ? <img src={seller.avatar} alt={seller.name} onError={(e) => { e.target.style.display = "none"; }} />
                : initials(seller)}
            </div>
            <div className="sp-hero-text">
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <h1 className="sp-hero-name">{seller.name}</h1>
                {seller.store_verified && (
                  <span className="sp-badge verified">✓ Verified</span>
                )}
                {seller.is_online && (
                  <span className="sp-badge online">● Online</span>
                )}
              </div>
              <div className="sp-hero-sub">
                {seller.store_name && <span>{seller.store_name}</span>}
                {seller.store_name && <span className="sp-hero-dot" />}
                <span>Member since {memberSince}</span>
                {(seller.state || seller.city) && (
                  <>
                    <span className="sp-hero-dot" />
                    <span>📍 {[seller.city, seller.state].filter(Boolean).join(", ")}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="sp-hero-tabs">
            <button className="sp-tab active">Listings</button>
            <button className="sp-tab">About</button>
            <button className="sp-tab">Reviews</button>
          </div>
        </header>

        {/* ── BODY ───────────────────────────── */}
        <div className="sp-body">
          <div className="sp-layout">

            {/* ── LEFT SIDEBAR ─────────────── */}
            <aside>

              {/* Stats overview */}
              <div className="sp-card">
                <div className="sp-stat-grid">
                  <div className="sp-stat-block">
                    <div className="sp-stat-block-num">{stats?.total_listings ?? 0}</div>
                    <div className="sp-stat-block-label">Listings</div>
                  </div>
                  <div className="sp-stat-block">
                    <div className="sp-stat-block-num">{stats?.total_sales ?? 0}</div>
                    <div className="sp-stat-block-label">Sales</div>
                  </div>
                </div>
                <div className="sp-card-body">
                  <div className="sp-rating-row">
                    <span className="sp-rating-num">{avgRating.toFixed(1)}</span>
                    <Stars rating={avgRating} />
                    <span className="sp-rating-count">({stats?.rating_count ?? 0} reviews)</span>
                  </div>
                  {seller.trust_score !== undefined && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--sp-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Trust Score</span>
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{seller.trust_score}/100</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: "var(--sp-border)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${seller.trust_score}%`, borderRadius: 4, background: seller.trust_score >= 75 ? "#2e7d32" : seller.trust_score >= 50 ? "var(--sp-gold)" : "var(--sp-accent)" }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact */}
              {(seller.phone || seller.whatsapp) && (
                <div className="sp-card">
                  <div className="sp-card-head"><h3>Contact Seller</h3></div>
                  <div className="sp-card-body">
                    {seller.phone && (
                      <div className="sp-contact-row">
                        <div className="sp-contact-icon phone">📞</div>
                        <div>
                          <div className="sp-contact-label">Phone</div>
                          <div className="sp-contact-val">
                            <a href={`tel:${seller.phone}`}>{seller.phone}</a>
                          </div>
                        </div>
                      </div>
                    )}
                    {seller.whatsapp && (
                      <div className="sp-contact-row">
                        <div className="sp-contact-icon wa">💬</div>
                        <div>
                          <div className="sp-contact-label">WhatsApp</div>
                          <div className="sp-contact-val">
                            <a href={`https://wa.me/${seller.whatsapp}`} target="_blank" rel="noopener noreferrer">
                              Chat on WhatsApp
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* About Store */}
              {seller.store_description && (
                <div className="sp-card">
                  <div className="sp-card-head"><h3>About Store</h3></div>
                  <div className="sp-card-body">
                    {seller.store_logo && (
                      <img src={seller.store_logo} alt="Store logo" style={{ height: 36, objectFit: "contain", marginBottom: 12, display: "block" }} />
                    )}
                    <p style={{ fontSize: "0.84rem", color: "var(--sp-muted)", lineHeight: 1.65, margin: 0 }}>
                      {seller.store_description}
                    </p>
                  </div>
                </div>
              )}
            </aside>

            {/* ── PRODUCT GRID ─────────────── */}
            <main>
              <div className="sp-section-head">
                <div>
                  <div className="sp-section-title">
                    {seller.store_name || seller.name}'s Listings
                  </div>
                  <div className="sp-section-sub">
                    Showing {products.length} of {stats?.total_listings ?? 0} total listings
                  </div>
                </div>
                {stats?.total_listings > 12 && (
                  <Link to={`/seller/${id}/all`} className="sp-view-all">View all →</Link>
                )}
              </div>

              {products.length === 0 ? (
                <div className="sp-empty">
                  <div className="sp-empty-icon">🏪</div>
                  <p className="sp-empty-text">This seller has no active listings yet.</p>
                </div>
              ) : (
                <div className="sp-product-grid">
                  {products.map((product) => (
                    <Link
                      key={product.id}
                      to={`/product/${product.slug || product.id}`}
                      className="sp-product-link"
                    >
                      <div className="sp-product-card">
                        <img
                          src={
                            Array.isArray(product.images) && product.images.length
                              ? product.images[0]
                              : product.main_image || "/api/placeholder/400/300"
                          }
                          alt={product.title}
                          className="sp-product-img"
                          loading="lazy"
                          onError={(e) => { e.target.src = "/api/placeholder/400/300"; }}
                        />
                        <div className="sp-product-info">
                          <div className="sp-product-title">{product.title}</div>
                          <div className="sp-product-price">{formatNaira(product.price)}</div>
                          <div className="sp-product-location">
                            📍 {product.location_city || product.location_state || "Nigeria"}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </main>
          </div>

          {/* ── FOOTER ──────────────────────── */}
          <footer className="sp-footer">
            <div className="sp-footer-grid">
              <div className="sp-footer-col">
                <h4>Categories</h4>
                <ul>
                  <li><Link to="/category/electronics">Electronics</Link></li>
                  <li><Link to="/category/clothing">Fashion</Link></li>
                  <li><Link to="/category/homes">Home &amp; Appliances</Link></li>
                  <li><Link to="/category/vehicles">Vehicles</Link></li>
                </ul>
              </div>
              <div className="sp-footer-col">
                <h4>Support</h4>
                <ul>
                  <li><Link to="/help">Help Center</Link></li>
                  <li><Link to="/terms">Terms &amp; Policies</Link></li>
                  <li><Link to="/privacy">Privacy Policy</Link></li>
                  <li><Link to="/contact">Contact Us</Link></li>
                </ul>
              </div>
              <div className="sp-footer-col">
                <h4>Company</h4>
                <ul>
                  <li><Link to="/about">About Minimart</Link></li>
                  <li><Link to="/blog">Blog</Link></li>
                  <li><Link to="/careers">Careers</Link></li>
                </ul>
              </div>
              <div className="sp-footer-col">
                <h4>Sell on Minimart</h4>
                <ul>
                  <li><Link to="/sell">Start Selling</Link></li>
                  <li><Link to="/seller/guide">Seller Guide</Link></li>
                  <li><Link to="/seller/fees">Fee Structure</Link></li>
                </ul>
              </div>
            </div>
            <div className="sp-footer-bottom">
              <span className="sp-footer-copy">© {new Date().getFullYear()} Minimart. All rights reserved.</span>
              <div className="sp-social-links">
                <Link to="#">Twitter</Link>
                <Link to="#">Instagram</Link>
                <Link to="#">Facebook</Link>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
};

export default SellerProfile;
