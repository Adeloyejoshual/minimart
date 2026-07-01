/**
 * src/pages/ProductDetail.jsx
 * Route: /product/:slug
 *
 * Main orchestrator — fetches data, passes to sub-components.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";

import ProductHeader from "./ProductDetail/ProductHeader";
import ContactStrip from "./ProductDetail/ContactStrip";
import ReviewSection from "./ProductDetail/Review";
import SafetyTips from "./ProductDetail/SafetyTips";
import SimilarProducts from "./ProductDetail/SimilarProducts";
import MoreFromSeller from "./ProductDetail/MoreFromSeller";

import "../styles/ProductDetail.css";

/* ═══════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════ */
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API = `${BASE_URL}/api`;
const FAV_KEY = "loemart_favs";
const REVIEWS_LIMIT = 5;

/* ═══════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const authH = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const readUserId = () => {
  try {
    const token = getToken();
    if (token) {
      const p = JSON.parse(atob(token.split(".")[1]));
      const id = p?.id || p?.sub || p?.userId || p?.user_id;
      if (id) return String(id);
    }
    for (const key of ["user", "loemart_user", "authUser"]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const p = JSON.parse(raw);
      const id = p?.id || p?.user?.id;
      if (id) return String(id);
    }
    return null;
  } catch {
    return null;
  }
};

/* ═══════════════════════════════════════════════════
   FAVOURITES
═══════════════════════════════════════════════════ */
const loadFavs = () => {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveFavs = (f) => {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(f));
  } catch {}
};

/* ═══════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════ */
function Skeleton() {
  return (
    <div className="pd-page">
      <div className="pd-sk-hero" />
      <div className="pd-sk-body">
        <div
          className="pd-sk-line"
          style={{ width: "35%", height: 11 }}
        />
        <div
          className="pd-sk-line"
          style={{ width: "90%", height: 24, marginTop: 8 }}
        />
        <div
          className="pd-sk-line"
          style={{ width: "45%", height: 32, marginTop: 10 }}
        />
        <div
          className="pd-sk-line"
          style={{
            width: "100%",
            height: 90,
            marginTop: 20,
            borderRadius: 12,
          }}
        />
        <div
          className="pd-sk-line"
          style={{
            width: "100%",
            height: 120,
            marginTop: 12,
            borderRadius: 12,
          }}
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
export default function ProductDetail({ user }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addSingleProduct } = useProductCache();

  /* ── State ───────────────────────────────────── */
  const [product, setProduct] = useState(null);
  const [seller, setSeller] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [moreSeller, setMoreSeller] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState(null);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewPage, setReviewPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fav, setFav] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);

  /* ── User ────────────────────────────────────── */
  const userId = useMemo(
    () => user?.id || readUserId(),
    [user]
  );

  const isOwn = !!(
    userId &&
    product?.seller_id &&
    userId === String(product.seller_id)
  );

  /* ═══════════════════════════════════════════════
     FETCHING
  ═══════════════════════════════════════════════ */

  // Product
  const loadProduct = useCallback(async () => {
    if (!slug || slug === "undefined") {
      setError("Invalid product link.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `${API}/product/slug/${encodeURIComponent(slug)}`
      );
      if (res.status === 404)
        throw new Error("Product not found");
      if (!res.ok) throw new Error("Could not load product");
      const data = await res.json();
      setProduct(data);
      addSingleProduct?.(data);
      setFav(!!loadFavs()[data.id]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [slug, addSingleProduct]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  // Track view
  useEffect(() => {
    if (!product?.id) return;
    fetch(`${API}/product/products/${product.id}/view`, {
      method: "POST",
    }).catch(() => {});
  }, [product?.id]);

  // Seller
  useEffect(() => {
    if (!product?.seller_id) return;
    fetch(`${API}/seller/${product.seller_id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setSeller(d.seller || d);
      })
      .catch(() => {});
  }, [product?.seller_id]);

  // More from seller
  useEffect(() => {
    if (!product?.seller_id || !product?.id) return;
    const qs = new URLSearchParams({
      seller_id: product.seller_id,
      exclude: product.id,
      limit: "8",
    });
    fetch(`${API}/product/by-seller?${qs}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setMoreSeller(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [product?.seller_id, product?.id]);

  // Similar
  useEffect(() => {
    if (!product?.id || !product?.category_id) return;
    const qs = new URLSearchParams({
      category_id: product.category_id,
      exclude: product.id,
      limit: "8",
    });
    fetch(`${API}/product/similar?${qs}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSimilar(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [product?.id, product?.category_id]);

  // Reviews
  const loadReviews = useCallback(
    async (page = 1) => {
      if (!slug) return;
      try {
        const res = await fetch(
          `${API}/product/slug/${encodeURIComponent(
            slug
          )}/reviews?limit=${REVIEWS_LIMIT}&page=${page}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setReviews((prev) =>
          page === 1
            ? data.reviews || []
            : [...prev, ...(data.reviews || [])]
        );
        if (data.stats) {
          setReviewStats(data.stats);
          setReviewTotal(data.stats.total || 0);
        }
      } catch {}
    },
    [slug]
  );

  useEffect(() => {
    loadReviews(1);
  }, [loadReviews]);

  /* ═══════════════════════════════════════════════
     ACTIONS
  ═══════════════════════════════════════════════ */

  // Favourite
  const toggleFav = useCallback(() => {
    if (!product?.id) return;
    const next = !fav;
    setFav(next);
    const favs = loadFavs();
    if (next) favs[product.id] = true;
    else delete favs[product.id];
    saveFavs(favs);
    if (userId) {
      fetch(
        `${API}/product/products/${product.id}/favorite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        }
      ).catch(() => {});
    }
  }, [fav, product, userId]);

  // WhatsApp
  const openWhatsApp = useCallback(() => {
    if (!product) return;
    fetch(
      `${API}/product/products/${product.id}/click`,
      { method: "POST" }
    ).catch(() => {});
    const waNumber =
      product?.whatsapp || product?.contact?.whatsapp;
    const waLink =
      product?.whatsapp_link ||
      product?.contact?.whatsapp_link;
    const msg = encodeURIComponent(
      `Hi, I'm interested in: ${product.title} — ${window.location.href}`
    );
    const url =
      waLink ||
      (waNumber
        ? `https://wa.me/${waNumber.replace(
            /\D/g,
            ""
          )}?text=${msg}`
        : null);
    if (url) window.open(url, "_blank");
  }, [product]);

  // Call
  const openCall = useCallback(() => {
    const phone =
      product?.phone || product?.contact?.phone;
    if (phone) window.location.href = `tel:${phone}`;
  }, [product]);

  // Chat
  const openChat = useCallback(async () => {
    if (!userId) {
      navigate(`/auth?redirect=/product/${slug}`);
      return;
    }
    if (isOwn || !product?.seller_id) return;
    setChatBusy(true);
    try {
      const res = await fetch(`${API}/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authH(),
        },
        body: JSON.stringify({
          buyerId: userId,
          sellerId: product.seller_id,
          productId: product.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      const threadId = data.thread_id || data.id;
      if (!threadId) throw new Error("No thread ID");
      navigate(`/chat/${threadId}`);
    } catch (err) {
      alert("Could not open chat: " + err.message);
    } finally {
      setChatBusy(false);
    }
  }, [userId, isOwn, product, slug, navigate]);

  // Navigate to product
  const goProduct = useCallback(
    (p) => {
      navigate(`/product/${p.slug || p.id}`);
    },
    [navigate]
  );

  /* ═══════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════ */

  if (loading) return <Skeleton />;

  if (error)
    return (
      <div className="pd-page">
        <div className="pd-error-wrap">
          <span className="pd-error-emoji">🔍</span>
          <h2 className="pd-error-title">{error}</h2>
          <p className="pd-error-sub">
            This listing may have been removed or the link is
            incorrect.
          </p>
          <Link to="/" className="pd-error-btn">
            Browse Marketplace
          </Link>
        </div>
      </div>
    );

  if (!product) return null;

  return (
    <div className="pd-page">
      {/* Gallery, title, price, desc, attrs, specs,
          delivery, FAQ */}
      <ProductHeader
        product={product}
        seller={seller}
        fav={fav}
        onToggleFav={toggleFav}
        onNavigateBack={() => navigate(-1)}
        isOwn={isOwn}
        onEditListing={() =>
          navigate(`/listings/edit/${product.id}`)
        }
      />

      {/* Contact buttons */}
      <ContactStrip
        product={product}
        userId={userId}
        isOwn={isOwn}
        chatBusy={chatBusy}
        onChat={openChat}
        onWhatsApp={openWhatsApp}
        onCall={openCall}
      />

      {/* Seller card */}
      {(seller || product.seller_id) && (
        <div className="pd-section">
          <h3 className="pd-section-h">Seller</h3>
          <div
            className="pd-seller-card"
            onClick={() =>
              navigate(`/seller/${product.seller_id}`)
            }
            role="button"
            tabIndex={0}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              navigate(`/seller/${product.seller_id}`)
            }
          >
            <div className="pd-seller-avatar">
              {seller?.profile_image ||
              seller?.store_logo ? (
                <img
                  src={
                    seller.profile_image || seller.store_logo
                  }
                  alt={seller.name}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <span>
                  {(seller?.name || "S")
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}
              {seller?.is_online && (
                <span className="pd-seller-online" />
              )}
            </div>

            <div className="pd-seller-info">
              <div className="pd-seller-name-row">
                <span className="pd-seller-name">
                  {seller?.store_name ||
                    seller?.name ||
                    "Seller"}
                </span>
                {seller?.verified && (
                  <span className="pd-seller-badge">
                    ✔ Verified
                  </span>
                )}
              </div>
              <div className="pd-seller-stats">
                {seller?.products_count > 0 && (
                  <span>
                    {seller.products_count} listings
                  </span>
                )}
                {seller?.total_sales > 0 && (
                  <span>
                    ·{" "}
                    {Number(
                      seller.total_sales
                    ).toLocaleString()}{" "}
                    sales
                  </span>
                )}
                {seller?.rating > 0 && (
                  <span>
                    · {Number(seller.rating).toFixed(1)}★
                  </span>
                )}
              </div>
              {seller?.trust_score != null && (
                <div className="pd-trust">
                  <div className="pd-trust-bar">
                    <div
                      className="pd-trust-fill"
                      style={{
                        width: `${Math.min(
                          100,
                          seller.trust_score
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="pd-trust-label">
                    {seller.trust_score}% trust
                  </span>
                </div>
              )}
            </div>

            <svg
              className="pd-seller-chevron"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </div>
      )}

      {/* Reviews */}
      <ReviewSection
        slug={slug}
        userId={userId}
        reviews={reviews}
        reviewStats={reviewStats}
        reviewTotal={reviewTotal}
        reviewPage={reviewPage}
        onLoadMore={() => {
          const next = reviewPage + 1;
          setReviewPage(next);
          loadReviews(next);
        }}
        onReviewDone={() => {
          setReviewPage(1);
          loadReviews(1);
        }}
      />

      {/* Safety Tips */}
      <SafetyTips />

      {/* Similar Products — MasonryCard grid */}
      <SimilarProducts
        products={similar}
        onProductClick={goProduct}
      />

      {/* More from Seller — horizontal scroll mobile */}
      <MoreFromSeller
        products={moreSeller}
        seller={seller}
        sellerId={product.seller_id}
        onProductClick={goProduct}
      />

      {/* spinner keyframes */}
      <style>{`
        @keyframes pd-spin {
          to { transform: rotate(360deg); }
        }
        .pd-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: pd-spin .7s linear infinite;
        }
      `}</style>
    </div>
  );
}