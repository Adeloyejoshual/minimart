import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Footer from "../components/Footer";
import "../styles/SellerProfile.css";

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

function TrustBar({ score = 0 }) {
  const level = score >= 75 ? "high" : score >= 50 ? "medium" : "low";
  return (
    <div style={{ marginTop: 16 }}>
      <div className="sp-trust-header">
        <span className="sp-trust-label">Trust Score</span>
        <span className="sp-trust-value">{score}/100</span>
      </div>
      <div className="sp-trust-track">
        <div
          className={`sp-trust-fill ${level}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function formatNaira(num) {
  return `₦${Number(num || 0).toLocaleString("en-NG")}`;
}

function initials(seller) {
  if (seller?.name)  return seller.name.charAt(0).toUpperCase();
  if (seller?.email) return seller.email.charAt(0).toUpperCase();
  return "S";
}

/* ─────────────────────────────────────────────
   Loading skeleton
───────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="sp-root">
      <div style={{ background: "#1a1a2e", padding: "56px 0 40px" }}>
        <div
          style={{
            maxWidth: 1140, margin: "0 auto", padding: "0 32px",
            display: "flex", gap: 24, alignItems: "flex-end",
          }}
        >
          <div className="sp-skel sp-skel-circle" style={{ width: 108, height: 108, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="sp-skel" style={{ height: 28, width: 220, marginBottom: 10 }} />
            <div className="sp-skel" style={{ height: 14, width: 160 }} />
          </div>
        </div>
      </div>
      <div className="sp-body">
        <div className="sp-layout">
          <div>
            <div className="sp-skel" style={{ height: 220, borderRadius: 14 }} />
          </div>
          <div>
            <div className="sp-skel" style={{ height: 28, width: 200, marginBottom: 20 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
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
  const [seller,   setSeller]   = useState(null);
  const [stats,    setStats]    = useState(null);
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

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
  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="sp-root">
        <div className="sp-error">
          <div className="sp-error-code">404</div>
          <p className="sp-error-msg">{error}</p>
          <Link to="/" className="sp-btn">← Back to Marketplace</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const memberSince = seller.created_at
    ? new Date(seller.created_at).toLocaleDateString("en-NG", {
        month: "long",
        year:  "numeric",
      })
    : "—";

  const avgRating = Number(stats?.avg_rating || 0);

  return (
    <div className="sp-root">

      {/* ── HERO ─────────────────────────────── */}
      <header className="sp-hero">
        <div className="sp-hero-inner">
          <div className="sp-avatar-wrap">
            {seller.avatar ? (
              <img
                src={seller.avatar}
                alt={seller.name}
                onError={(e) => { e.target.style.display = "none"; }}
              />
            ) : (
              initials(seller)
            )}
          </div>

          <div className="sp-hero-text">
            <div
              style={{
                display: "flex", alignItems: "center",
                gap: 10, flexWrap: "wrap", marginBottom: 6,
              }}
            >
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

      {/* ── BODY ─────────────────────────────── */}
      <div className="sp-body">
        <div className="sp-layout">

          {/* ── LEFT SIDEBAR ───────────────── */}
          <aside>

            {/* Stats card */}
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
                  <TrustBar score={seller.trust_score} />
                )}
              </div>
            </div>

            {/* Contact card */}
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
                          <a
                            href={`https://wa.me/${seller.whatsapp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Chat on WhatsApp
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* About Store card */}
            {seller.store_description && (
              <div className="sp-card">
                <div className="sp-card-head"><h3>About Store</h3></div>
                <div className="sp-card-body">
                  {seller.store_logo && (
                    <img
                      src={seller.store_logo}
                      alt="Store logo"
                      style={{ height: 36, objectFit: "contain", marginBottom: 12, display: "block" }}
                    />
                  )}
                  <p style={{ fontSize: "0.84rem", color: "var(--sp-muted)", lineHeight: 1.65, margin: 0 }}>
                    {seller.store_description}
                  </p>
                </div>
              </div>
            )}
          </aside>

          {/* ── PRODUCT GRID ───────────────── */}
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
              {(stats?.total_listings ?? 0) > 12 && (
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
      </div>

      {/* ── FOOTER (shared component) ─────── */}
      <Footer />
    </div>
  );
};

export default SellerProfile;
