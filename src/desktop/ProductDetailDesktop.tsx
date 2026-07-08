// src/desktop/ProductDetailDesktop.tsx

import { memo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useProductDetail }    from "../hooks/useProductDetail";
import { ProductGallery }      from "./components/ProductGallery";
import { StickyContactPanel }  from "./components/StickyContactPanel";
import { ProductTabs }         from "./components/ProductTabs";
import { DesktopSellerCard }   from "./components/DesktopSellerCard";

import SafetyTips      from "../pages/ProductDetail/SafetyTips";
import MoreFromSeller  from "../pages/ProductDetail/MoreFromSeller";
import SimilarProducts from "../pages/ProductDetail/SimilarProducts";

import type { User } from "../hooks/useProductDetail";

import "./ProductDetailDesktop.css";

/* ═══════════════════════════════════════════════════════════════
   FORMAT HELPERS
═══════════════════════════════════════════════════════════════ */
const formatNaira = (n: number | undefined): string =>
  "₦" + Number(n || 0).toLocaleString("en-NG");

const timeAgo = (d?: string): string => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1_000);
  if (s < 86_400)    return `${Math.floor(s / 3_600)}h ago`;
  if (s < 2_592_000) return `${Math.floor(s / 86_400)}d ago`;
  return new Date(d).toLocaleDateString("en-NG", { month: "short", year: "numeric" });
};

/* ═══════════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════════ */
const DesktopSkeleton = memo(function DesktopSkeleton() {
  return (
    <div className="pdd-page pdd-page--loading" aria-busy="true" aria-label="Loading product">
      <div className="pdd-sk-breadcrumb" />
      <div className="pdd-sk-body">
        <div className="pdd-sk-gallery" />
        <div className="pdd-sk-panel">
          <div className="pdd-sk-line" style={{ width: "40%",  height: 14 }} />
          <div className="pdd-sk-line" style={{ width: "80%",  height: 32, marginTop: 12 }} />
          <div className="pdd-sk-line" style={{ width: "30%",  height: 40, marginTop: 16 }} />
          <div className="pdd-sk-line" style={{ width: "100%", height: 56, marginTop: 24, borderRadius: 10 }} />
          <div className="pdd-sk-line" style={{ width: "100%", height: 56, marginTop: 8,  borderRadius: 10 }} />
          <div className="pdd-sk-line" style={{ width: "100%", height: 56, marginTop: 8,  borderRadius: 10 }} />
        </div>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   BREADCRUMB
═══════════════════════════════════════════════════════════════ */
interface BreadcrumbProps {
  title?: string;
  category?: string;
}

const Breadcrumb = memo(function Breadcrumb({ title, category }: BreadcrumbProps) {
  return (
    <nav className="pdd-breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li><Link to="/">Home</Link></li>
        <li aria-hidden="true">›</li>
        {category && (
          <>
            <li><Link to={`/?category=${encodeURIComponent(category)}`}>{category}</Link></li>
            <li aria-hidden="true">›</li>
          </>
        )}
        <li aria-current="page">
          <span>{title ? (title.length > 50 ? title.slice(0, 50) + "…" : title) : "Product"}</span>
        </li>
      </ol>
    </nav>
  );
});

/* ═══════════════════════════════════════════════════════════════
   DESKTOP PAGE
═══════════════════════════════════════════════════════════════ */
interface ProductDetailDesktopProps {
  user?: User;
}

export default function ProductDetailDesktop({ user }: ProductDetailDesktopProps) {
  const navigate = useNavigate();

  /* Single hook — all business logic, zero duplication */
  const {
    product, seller, similar, moreSeller,
    reviews, reviewStats, reviewTotal, reviewPage,
    loading, error, fav, chatBusy, chatError,
    isOwn, userId, slug,
    toggleFav, openWhatsApp, openCall, openChat,
    goProduct, dismissChatError,
    handleLoadMoreReviews, handleReviewDone,
  } = useProductDetail(user);

  /* ── error state ─────────────────────────────────────────── */
  if (loading) return <DesktopSkeleton />;

  if (error)
    return (
      <div className="pdd-page" role="main">
        <div className="pdd-error" role="alert">
          <span className="pdd-error-emoji" aria-hidden="true">🔍</span>
          <h2 className="pdd-error-title">{error}</h2>
          <p className="pdd-error-sub">
            This listing may have been removed or the link is incorrect.
          </p>
          <Link to="/" className="pdd-error-btn">Browse Marketplace</Link>
        </div>
      </div>
    );

  if (!product) return null;

  /* ── render ──────────────────────────────────────────────── */
  return (
    <div className="pdd-page" role="main">

      {/* ── Chat error toast ─────────────────────────────── */}
      {chatError && (
        <div className="pdd-toast pdd-toast--error" role="alert" aria-live="assertive">
          <span>{chatError}</span>
          <button
            className="pdd-toast-close"
            onClick={dismissChatError}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Breadcrumb ───────────────────────────────────── */}
      <Breadcrumb title={product.title} />

      {/* ══════════════════════════════════════════════════
          HERO  — Gallery (left) + Sticky Panel (right)
      ══════════════════════════════════════════════════ */}
      <div className="pdd-hero">

        {/* Left: Gallery */}
        <div className="pdd-hero-gallery">
          <ProductGallery product={product} />
        </div>

        {/* Right: Sticky panel */}
        <div className="pdd-hero-panel">

          {/* Product title block */}
          <header className="pdd-product-header">
            {product.condition && (
              <span className="pdd-condition-badge">{product.condition}</span>
            )}
            <h1 className="pdd-product-title">{product.title}</h1>

            <div className="pdd-product-meta-row">
              {(product.location_city || product.location?.city) && (
                <span className="pdd-product-loc">
                  📍 {product.location_city || product.location?.city}
                </span>
              )}
              {product.views_count != null && (
                <span className="pdd-product-views" aria-label={`${product.views_count} views`}>
                  👁 {Number(product.views_count).toLocaleString()} views
                </span>
              )}
              {product.created_at && (
                <span className="pdd-product-age">
                  Posted {timeAgo(product.created_at)}
                </span>
              )}
            </div>

            {/* Rating summary beside title if reviews exist */}
            {reviewStats && reviewStats.total > 0 && (
              <div className="pdd-product-rating-row">
                <span className="pdd-product-stars" aria-hidden="true">
                  {"★".repeat(Math.round(reviewStats.average))}
                  {"☆".repeat(5 - Math.round(reviewStats.average))}
                </span>
                <span className="pdd-product-rating-num">
                  {Number(reviewStats.average).toFixed(1)}
                </span>
                <span className="pdd-product-rating-count">
                  ({reviewStats.total} review{reviewStats.total !== 1 ? "s" : ""})
                </span>
              </div>
            )}
          </header>

          {/* Sticky contact panel */}
          <div className="pdd-sticky-wrapper">
            <StickyContactPanel
              product={product}
              seller={seller}
              fav={fav}
              isOwn={isOwn}
              chatBusy={chatBusy}
              onToggleFav={toggleFav}
              onChat={openChat}
              onWhatsApp={openWhatsApp}
              onCall={openCall}
              onEditListing={() => navigate(`/listings/edit/${product.id}`)}
            />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          TABS  — Description | Specifications | Reviews
      ══════════════════════════════════════════════════ */}
      <div className="pdd-content-area">
        <div className="pdd-tabs-col">
          <ProductTabs
            product={product}
            slug={slug!}
            userId={userId}
            reviews={reviews}
            reviewStats={reviewStats}
            reviewTotal={reviewTotal}
            reviewPage={reviewPage}
            onLoadMore={handleLoadMoreReviews}
            onReviewDone={handleReviewDone}
          />
        </div>

        {/* Sidebar — safety + seller full card */}
        <aside className="pdd-sidebar">
          <SafetyTips />

          <DesktopSellerCard
            seller={seller}
            sellerId={product.seller_id}
          />
        </aside>
      </div>

      {/* ══════════════════════════════════════════════════
          MORE FROM SELLER
      ══════════════════════════════════════════════════ */}
      <MoreFromSeller
        products={moreSeller}
        seller={seller}
        sellerId={product.seller_id}
        onProductClick={goProduct}
      />

      {/* ══════════════════════════════════════════════════
          SIMILAR PRODUCTS
      ══════════════════════════════════════════════════ */}
      <SimilarProducts
        products={similar}
        onProductClick={goProduct}
      />
    </div>
  );
}