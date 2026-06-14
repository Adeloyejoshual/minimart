// pages/MarketDetail.jsx

import React, {
  useState, useEffect, useCallback, useMemo, memo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

import {
  API_URL,
  formatPrice,
  calcDiscount,
  getProductImage,
} from "../config/marketplace";
import useWishlist from "../hooks/useWishlist";

// ── Child components ──
import MarketDetailHeader from "../components/MarketDetailHeader";
import ImageGallery       from "./MarketDetail/ImageGallery";
import VariantSelector    from "./MarketDetail/VariantSelector";
import SellerCard         from "./MarketDetail/SellerCard";
import ProductInfo        from "./MarketDetail/ProductInfo";
import SpecsSection       from "./MarketDetail/SpecsSection";
import RelatedProducts    from "./MarketDetail/RelatedProducts";

import "../styles/MarketDetail.css";

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const CART_KEY   = "mm_cart";
const CART_API   = "https://minimart-ivrm.onrender.com/api/cart";

function authHeaders() {
  const token = localStorage.getItem("marketplace_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ════════════════════════════════════════════════════════════
   ICONS (only ones not in the header)
════════════════════════════════════════════════════════════ */
const Icon = {
  flag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

/* ════════════════════════════════════════════════════════════
   SKELETON
════════════════════════════════════════════════════════════ */
function ProductSkeleton() {
  return (
    <div className="md-skeleton" aria-busy="true" aria-label="Loading product">
      <div className="md-skel md-skel-hero" />
      <div className="md-skel-thumbs">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="md-skel md-skel-thumb" />
        ))}
      </div>
      <div className="md-skel-body">
        <div className="md-skel md-skel-line" style={{ width: "40%", height: 13 }} />
        <div className="md-skel md-skel-line" style={{ width: "85%", height: 22, margin: "10px 0" }} />
        <div className="md-skel md-skel-line" style={{ width: "30%", height: 28 }} />
        <div style={{ height: 20 }} />
        <div className="md-skel md-skel-line" style={{ width: "100%", height: 80, borderRadius: 12 }} />
        <div style={{ height: 12 }} />
        <div className="md-skel md-skel-line" style={{ width: "100%", height: 120, borderRadius: 12 }} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   REPORT MODAL
════════════════════════════════════════════════════════════ */
const REPORT_REASONS = [
  "Fake or counterfeit product",
  "Wrong or misleading information",
  "Prohibited item",
  "Spam or scam",
  "Inappropriate content",
  "Other",
];

const ReportModal = memo(function ReportModal({ productId, onClose }) {
  const [reason,     setReason]     = useState("");
  const [details,    setDetails]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/${productId}/report`, { reason, details });
      setSubmitted(true);
    } catch {
      /* keep modal open so user can retry */
    } finally {
      setSubmitting(false);
    }
  }, [productId, reason, details]);

  return (
    <div className="md-modal-overlay" onClick={onClose}
      role="dialog" aria-modal="true" aria-label="Report listing">
      <div className="md-modal" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <div className="md-report-done">
            <div className="md-report-check">{Icon.check}</div>
            <h3>Report Submitted</h3>
            <p>Our team will review this listing. Thank you for keeping Minimart safe.</p>
            <button className="md-done-btn" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="md-modal-header">
              <h3>Report Listing</h3>
              <button className="md-modal-x" onClick={onClose} aria-label="Close">✕</button>
            </div>
            <div className="md-modal-body">
              <p className="md-modal-sub">Why are you reporting this listing?</p>
              <div className="md-report-reasons">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r}
                    className={`md-reason-btn${reason === r ? " md-reason-btn--active" : ""}`}
                    onClick={() => setReason(r)}
                    aria-pressed={reason === r}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                className="md-report-textarea"
                placeholder="Additional details (optional)…"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                maxLength={500}
                aria-label="Additional details"
              />
            </div>
            <div className="md-modal-footer">
              <button className="md-modal-cancel" onClick={onClose}>Cancel</button>
              <button
                className="md-modal-submit"
                onClick={handleSubmit}
                disabled={!reason || submitting}
              >
                {submitting ? "Submitting…" : "Submit Report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   SHARE SHEET
════════════════════════════════════════════════════════════ */
const ShareSheet = memo(function ShareSheet({ product, onClose }) {
  const pageUrl = window.location.href;
  const text    = `Check out ${product.name} on Minimart — ${formatPrice(product.price)}`;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    axios.post(`${API_URL}/${product.id}/share`).catch(() => {});
  }, [product.id]);

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* silently fail */ }
  }, [pageUrl]);

  const shareOptions = useMemo(() => [
    {
      label: "WhatsApp", icon: "💬", color: "#25D366",
      href: `https://wa.me/?text=${encodeURIComponent(`${text} ${pageUrl}`)}`,
    },
    {
      label: "Twitter", icon: "🐦", color: "#1DA1F2",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(pageUrl)}`,
    },
    {
      label: "Facebook", icon: "📘", color: "#1877F2",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`,
    },
    {
      label: "Telegram", icon: "✈️", color: "#0088cc",
      href: `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(text)}`,
    },
  ], [text, pageUrl]);

  const thumbSrc = getProductImage(product);

  return (
    <div className="md-modal-overlay" onClick={onClose}
      role="dialog" aria-modal="true" aria-label="Share product">
      <div className="md-share-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="md-share-handle" aria-hidden="true" />
        <h3 className="md-share-title">Share this product</h3>
        <div className="md-share-preview">
          {thumbSrc && (
            <img src={thumbSrc} alt={product.name} className="md-share-thumb" />
          )}
          <div>
            <p className="md-share-name">{product.name}</p>
            <p className="md-share-price">{formatPrice(product.price)}</p>
          </div>
        </div>
        <div className="md-share-options">
          {shareOptions.map((opt) => (
            <a key={opt.label} href={opt.href} target="_blank"
              rel="noopener noreferrer" className="md-share-opt"
              style={{ "--sc": opt.color }}
              aria-label={`Share on ${opt.label}`}>
              <span className="md-share-opt-icon">{opt.icon}</span>
              <span className="md-share-opt-label">{opt.label}</span>
            </a>
          ))}
        </div>
        <button className="md-copy-link" onClick={copyLink}>
          {copied ? "✅ Link Copied!" : "📋 Copy Link"}
        </button>
        <button className="md-share-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   TRUST BADGES
════════════════════════════════════════════════════════════ */
const TRUST_BADGES = [
  { icon: "🔒", label: "Secure\nPayment"  },
  { icon: "✅", label: "Verified\nSeller"  },
  { icon: "🚚", label: "Managed\nDelivery" },
  { icon: "↩️", label: "Easy\nReturns"     },
];

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════ */
export default function MarketDetail({ user }) {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const { items: wishlist, toggle: toggleWishlist } = useWishlist();

  /* ── State ── */
  const [product,         setProduct]         = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [addedToCart,     setAddedToCart]     = useState(false);
  const [showReport,      setShowReport]      = useState(false);
  const [showShare,       setShowShare]       = useState(false);

  const [cartCount, setCartCount] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || "[]").length;
    } catch {
      return 0;
    }
  });

  /* Keep cart count synced across tabs */
  useEffect(() => {
    const sync = () => {
      try {
        setCartCount(JSON.parse(localStorage.getItem(CART_KEY) || "[]").length);
      } catch {
        setCartCount(0);
      }
    };
    window.addEventListener("cart-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cart-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /* ── Derived ── */
  const isWishlisted = product ? wishlist.has(product.id) : false;

  /* ── Fetch product ── */
  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setProduct(null);
    setSelectedVariant(null);

    axios
      .get(`${API_URL}/${slug}`, { timeout: 12000 })
      .then(({ data }) => {
        if (cancelled) return;
        const p = data?.data ?? data?.product ?? data;
        setProduct(p);
        if (p?.variants?.length > 0) setSelectedVariant(p.variants[0]);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.status === 404 ? "404" : "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [slug]);

  /* ── Pricing ── */
  const displayPrice = useMemo(() => {
    if (selectedVariant?.price) return Number(selectedVariant.price);
    return Number(product?.price ?? 0);
  }, [selectedVariant, product]);

  const originalPrice = useMemo(
    () => Number(product?.original_price ?? product?.compare_price ?? 0),
    [product],
  );

  const discount = useMemo(
    () => calcDiscount(displayPrice, originalPrice),
    [displayPrice, originalPrice],
  );

  const savings = useMemo(
    () => (originalPrice > displayPrice ? originalPrice - displayPrice : 0),
    [originalPrice, displayPrice],
  );

  /* ── View count ── */
  const viewLabel = useMemo(() => {
    const v = product?.view_count ?? 0;
    return v > 999 ? `${(v / 1000).toFixed(1)}k` : v;
  }, [product?.view_count]);

  /* ══════════════════════════════════════════════════════
     ADD TO CART — works for BOTH guests and logged-in
  ══════════════════════════════════════════════════════ */
  const handleAddToCart = useCallback(async () => {
    if (!product) return;

    const variantId = selectedVariant?.id ?? null;

    /* ── Logged-in: use API ── */
    if (user) {
      try {
        const { data } = await axios.post(
          CART_API,
          {
            productId: product.id,
            variantId,
            qty: 1,
          },
          { headers: authHeaders() }
        );
        setCartCount(data.data?.cartCount ?? cartCount + 1);
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 2500);
        window.dispatchEvent(new Event("cart-updated"));
      } catch (err) {
        console.error("[addToCart]", err.response?.data?.message ?? err.message);
      }
      return;
    }

    /* ── Guest: use localStorage ── */
    try {
      const cart     = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      const itemId   = `${product.id}__${variantId ?? "default"}`;
      const existing = cart.findIndex((c) => c.id === itemId);

      const item = {
        id:        itemId,
        productId: product.id,
        name:      product.name,
        image:     getProductImage(product),
        price:     displayPrice,
        originalPrice: originalPrice > displayPrice ? originalPrice : null,
        variant:   selectedVariant
          ? { id: selectedVariant.id, name: selectedVariant.name, sku: selectedVariant.sku }
          : null,
        slug:    product.slug ?? product.id,
        qty:     1,
        stock:   selectedVariant?.stock ?? product?.stock ?? 99,
        addedAt: Date.now(),
      };

      if (existing >= 0) {
        const maxQty = item.stock;
        cart[existing].qty = Math.min(cart[existing].qty + 1, maxQty);
      } else {
        cart.push(item);
      }

      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      setCartCount(cart.length);
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2500);
      window.dispatchEvent(new Event("cart-updated"));
    } catch {
      /* localStorage blocked */
    }
  }, [product, selectedVariant, displayPrice, originalPrice, user, cartCount]);

  /* ── Buy now ── */
  const handleBuyNow = useCallback(() => {
    handleAddToCart();
    setTimeout(() => navigate("/shop/checkout"), 300);
  }, [handleAddToCart, navigate]);

  /* ── Modals ── */
  const openReport  = useCallback(() => setShowReport(true),  []);
  const closeReport = useCallback(() => setShowReport(false), []);
  const openShare   = useCallback(() => { if (product) setShowShare(true); }, [product]);
  const closeShare  = useCallback(() => setShowShare(false), []);

  const handleWishlist = useCallback(() => {
    if (product) toggleWishlist(product.id);
  }, [product, toggleWishlist]);

  /* ════════════════════════════════════════════
     ERROR SCREENS
  ════════════════════════════════════════════ */
  if (!loading && error === "404") {
    return (
      <div className="md-not-found">
        <span className="md-nf-icon">🔍</span>
        <h2>Product Not Found</h2>
        <p>This listing may have been removed or is no longer available.</p>
        <button className="md-nf-btn" onClick={() => navigate("/minimart")}>
          Browse Products
        </button>
      </div>
    );
  }

  if (!loading && error) {
    return (
      <div className="md-not-found">
        <span className="md-nf-icon">⚠️</span>
        <h2>Something went wrong</h2>
        <p>Could not load this product. Please try again.</p>
        <button className="md-nf-btn" onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <>
      <div className="md-page">

        {/* ── Header (extracted) ── */}
        <MarketDetailHeader
          productName={product?.name}
          cartCount={cartCount}
          isWishlisted={isWishlisted}
          onShare={openShare}
          onToggleWishlist={handleWishlist}
          productLoaded={!!product}
        />

        {/* ── Skeleton ── */}
        {loading && <ProductSkeleton />}

        {/* ── Product ── */}
        {!loading && product && (
          <>
            {/* Gallery */}
            <ImageGallery
              images={product.images ?? []}
              name={product.name}
            />

            {/* Content */}
            <div className="md-content">

              {/* Badges */}
              <div className="md-badges-row">
                {product.category && (
                  <span className="md-cat-pill">{product.category}</span>
                )}
                {product.is_featured && (
                  <span className="md-badge md-badge--featured">⭐ Featured</span>
                )}
                {product.is_trending && (
                  <span className="md-badge md-badge--trending">🔥 Trending</span>
                )}
                {product.condition && product.condition !== "new" && (
                  <span className="md-badge md-badge--cond">{product.condition}</span>
                )}
              </div>

              {/* Title */}
              <h1 className="md-title">{product.name}</h1>

              {/* Brand */}
              {product.brand && (
                <p className="md-brand">by <strong>{product.brand}</strong></p>
              )}

              {/* Price */}
              <div className="md-price-block">
                <span className="md-price">{formatPrice(displayPrice)}</span>
                {originalPrice > displayPrice && (
                  <>
                    <span className="md-original">{formatPrice(originalPrice)}</span>
                    <span className="md-disc-badge">-{discount}%</span>
                  </>
                )}
              </div>

              {savings > 0 && (
                <p className="md-savings">🎉 You save {formatPrice(savings)}</p>
              )}

              {/* Stats */}
              {(product.view_count > 0 ||
                product.save_count > 0 ||
                product.variants?.length > 0) && (
                <div className="md-stats-row">
                  {product.view_count > 0 && (
                    <span className="md-stat">👁 {viewLabel} views</span>
                  )}
                  {product.save_count > 0 && (
                    <span className="md-stat">❤️ {product.save_count} saved</span>
                  )}
                  {product.variants?.length > 0 && (
                    <span className="md-stat">📦 {product.variants.length} variants</span>
                  )}
                </div>
              )}

              {/* Variants */}
              {product.variants?.length > 0 && (
                <VariantSelector
                  variants={product.variants}
                  selected={selectedVariant}
                  onSelect={setSelectedVariant}
                />
              )}

              {/* Delivery note */}
              <div className="md-delivery-note">
                <span aria-hidden="true">🚚</span>
                <div>
                  <strong>Managed Delivery by Minimart</strong>
                  <p>We handle shipping, tracking and delivery for all orders</p>
                </div>
              </div>

              {/* Description */}
              {product.description && (
                <ProductInfo description={product.description} />
              )}

              {/* Key Features */}
              {product.key_features?.length > 0 && (
                <div className="md-section">
                  <h3 className="md-section-title">Key Features</h3>
                  <ul className="md-features-list">
                    {product.key_features.map((f, i) => (
                      <li key={i} className="md-feature-item">
                        <span className="md-feat-check" aria-hidden="true">✓</span>
                        <span>{f?.feature ?? f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Specifications */}
              {product.specifications?.length > 0 && (
                <SpecsSection specs={product.specifications} />
              )}

              {/* What's in the Box */}
              {product.whats_in_box?.length > 0 && (
                <div className="md-section">
                  <h3 className="md-section-title">What's in the Box</h3>
                  <ul className="md-box-list">
                    {product.whats_in_box.map((b, i) => (
                      <li key={i} className="md-box-item">
                        <span aria-hidden="true">📦</span>
                        <span>{b?.item ?? b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Policies */}
              {(product.return_policy || product.warranty) && (
                <div className="md-section">
                  <h3 className="md-section-title">Policies</h3>
                  {product.return_policy && (
                    <div className="md-policy-item">
                      <span aria-hidden="true">↩️</span>
                      <div>
                        <strong>Return Policy</strong>
                        <p>{product.return_policy}</p>
                      </div>
                    </div>
                  )}
                  {product.warranty && (
                    <div className="md-policy-item">
                      <span aria-hidden="true">🛡️</span>
                      <div>
                        <strong>Warranty</strong>
                        <p>{product.warranty}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tags */}
              {product.tags?.length > 0 && (
                <div className="md-tags-row">
                  {product.tags.map((t) => (
                    <span key={t} className="md-tag">#{t}</span>
                  ))}
                </div>
              )}

              {/* Seller */}
              <SellerCard product={product} />

              {/* Trust badges */}
              <div className="md-trust-grid" aria-label="Trust indicators">
                {TRUST_BADGES.map((b) => (
                  <div key={b.label} className="md-trust-item">
                    <span aria-hidden="true">{b.icon}</span>
                    <span style={{ whiteSpace: "pre-line" }}>{b.label}</span>
                  </div>
                ))}
              </div>

              {/* Report */}
              <button className="md-report-btn" onClick={openReport}>
                {Icon.flag}
                <span>Report this listing</span>
              </button>

            </div>{/* end md-content */}

            {/* ── Related Products ── */}
            {product.category && (
              <RelatedProducts
                category={product.category}
                excludeId={product.id}
              />
            )}

            {/* Bottom spacer for sticky bar */}
            <div style={{ height: 110 }} aria-hidden="true" />

          </>
        )}
      </div>

      {/* ── Sticky bottom bar ── */}
      {!loading && product && (
        <div className="md-sticky-bar" role="region" aria-label="Purchase actions">
          <div className="md-sticky-price-wrap">
            <span className="md-sticky-price">{formatPrice(displayPrice)}</span>
            {discount >= 10 && (
              <span className="md-sticky-disc" aria-hidden="true">-{discount}%</span>
            )}
          </div>
          <div className="md-sticky-actions">
            <button
              className={`md-btn-cart${addedToCart ? " md-btn-cart--done" : ""}`}
              onClick={handleAddToCart}
              aria-label={addedToCart ? "Added to cart" : "Add to cart"}
            >
              {addedToCart ? "✓ Added!" : "Add to Cart"}
            </button>
            <button className="md-btn-buy" onClick={handleBuyNow} aria-label="Buy now">
              Buy Now
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showReport && product && (
        <ReportModal productId={product.id} onClose={closeReport} />
      )}
      {showShare && product && (
        <ShareSheet product={product} onClose={closeShare} />
      )}
    </>
  );
}