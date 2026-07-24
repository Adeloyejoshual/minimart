// src/pages/Profile/components/Listings.jsx
import { memo } from "react";
import { Link } from "react-router-dom";
import { Ic } from "./icons";
import ProductCard from "./ProductCard";
import EmptyState from "./EmptyState";
import { ProdSkeleton } from "./Skeletons";
import ErrorBoundary from "./ErrorBoundary"; // 👈 import
import "./Listings.css";

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const TABS = [
  { key: "all",            label: "All"     },
  { key: "active",         label: "Active"  },
  { key: "active_limited", label: "Trial"   },
  { key: "draft",          label: "Drafts"  },
  { key: "paused",         label: "Paused"  },
  { key: "pending",        label: "Pending" },
];

/* ─────────────────────────────────────────────
   TierBadge
───────────────────────────────────────────── */
const TierBadge = memo(({ tier }) => {
  if (tier === "subscriber")
    return (
      <span className="listings__tier-badge listings__tier-badge--pro">
        <Ic.Zap /> Pro
      </span>
    );
  if (tier === "verified")
    return (
      <span className="listings__tier-badge listings__tier-badge--verified">
        <Ic.CheckCircle /> Verified
      </span>
    );
  return (
    <span className="listings__tier-badge listings__tier-badge--trial">
      <Ic.Clock /> Trial
    </span>
  );
});
TierBadge.displayName = "TierBadge";

/* ─────────────────────────────────────────────
   UpsellBanner
───────────────────────────────────────────── */
const UpsellBanner = memo(({ tier, count }) => {
  if (tier === "unverified" && count >= 2)
    return (
      <div className="listings__upsell-banner listings__upsell-banner--verify">
        <Ic.Shield />
        <div className="listings__upsell-text">
          <strong>Upgrade to Verified</strong>
          <p>
            You've used {count} of 3 trial listings. Verify your identity
            to unlock 500 free listings + 30-day windows.
          </p>
        </div>
        <Link to="/verification" className="btn btn--primary btn--sm">
          Verify Now
        </Link>
      </div>
    );

  if (tier === "verified" && count >= 450)
    return (
      <div className="listings__upsell-banner listings__upsell-banner--subscribe">
        <Ic.Zap />
        <div className="listings__upsell-text">
          <strong>Approaching your 500-listing limit</strong>
          <p>
            You've used {count} of 500 free listings. Subscribe to Pro for
            unlimited posting.
          </p>
        </div>
        <Link to="/seller/subscription/plans" className="btn btn--primary btn--sm">
          View Plans
        </Link>
      </div>
    );

  return null;
});
UpsellBanner.displayName = "UpsellBanner";

/* ─────────────────────────────────────────────
   TabInfoBanner
───────────────────────────────────────────── */
const TabInfoBanner = memo(({ tab, tier, hasProducts }) => {
  if (!hasProducts) return null;

  if (tab === "active_limited")
    return (
      <div className="listings__info-banner listings__info-banner--trial">
        <Ic.Clock />
        <div>
          <strong>Trial listings expire in 7 days</strong>
          <p>
            {tier === "unverified"
              ? "Verify your identity to make these listings permanent."
              : "Tap 'Activate' on any listing to convert it to a full listing."}
          </p>
        </div>
        {tier === "unverified" && (
          <Link to="/verification" className="btn btn--primary btn--sm">
            Verify
          </Link>
        )}
      </div>
    );

  if (tab === "pending")
    return (
      <div className="listings__info-banner">
        <Ic.AlertCircle />
        <div>
          <strong>Payment required</strong>
          <p>Complete payment to activate these listings.</p>
        </div>
      </div>
    );

  if (tab === "paused" && tier === "unverified")
    return (
      <div className="listings__info-banner listings__info-banner--warn">
        <Ic.AlertCircle />
        <div>
          <strong>Paused listings can't be reactivated</strong>
          <p>Verify your identity to unlock reactivation.</p>
        </div>
        <Link to="/verification" className="btn btn--primary btn--sm">
          Verify
        </Link>
      </div>
    );

  return null;
});
TabInfoBanner.displayName = "TabInfoBanner";

/* ─────────────────────────────────────────────
   Empty helpers
───────────────────────────────────────────── */
const emptyTitle = (tab, search) => {
  if (search)                   return `No results for "${search}"`;
  if (tab === "pending")        return "No pending payments";
  if (tab === "active_limited") return "No trial listings";
  if (tab === "all")            return "No listings yet";
  return `No ${tab} listings`;
};

const emptyDescription = (tab, search) => {
  if (search)                   return "Try a different search term.";
  if (tab === "pending")        return "All your listings are paid up!";
  if (tab === "active_limited") return "You don't have any trial listings right now.";
  return "Start selling by creating your first listing.";
};

/* ─────────────────────────────────────────────
   ProductRow — one card wrapped in error boundary
   Shows the REAL error if ProductCard crashes
───────────────────────────────────────────── */
function ProductRow({ product, ...props }) {
  /* Guard: completely skip malformed products */
  if (!product || !product.id) {
    console.warn("[Listings] Malformed product skipped:", product);
    return null;
  }

  return (
    <ErrorBoundary label={`Product #${product.id} — "${product.title ?? "?"}"`}>
      <ProductCard product={product} {...props} />
    </ErrorBoundary>
  );
}

/* ─────────────────────────────────────────────
   Listings
───────────────────────────────────────────── */
export default function Listings({
  products      = [],
  prodLoading   = false,
  loadingMore   = false,
  hasMore       = false,
  tab           = "all",
  search        = "",
  tabCounts     = {},
  deleting      = null,
  verifying     = null,
  renewing      = null,
  tier          = "unverified",
  isSubscriber  = false,
  onTabChange,
  onSearch,
  onLoadMore,
  onNavigate,
  onEdit,
  onDelete,
  onToggle,
  onRenew,
  onPromote,
  onPayNow,
  onVerifyPayment,
}) {
  const visibleTabs = TABS.filter((t) => {
    if (t.key === "active_limited") {
      return (tabCounts[t.key] ?? 0) > 0 || tier === "unverified";
    }
    return true;
  });

  const totalCount  = tabCounts.all ?? products.length ?? 0;
  const hasProducts = !prodLoading && products.length > 0;

  return (
    <div className="listings">
      <div className="listings__card">

        {/* ── Header ── */}
        <div className="listings__header">
          <div className="listings__header-left">
            <h2 className="listings__title">My Listings</h2>
            <TierBadge tier={tier} />
          </div>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => onNavigate?.("/minimart/add")}
          >
            <Ic.Plus /> Add New
          </button>
        </div>

        {/* ── Upsell ── */}
        <UpsellBanner tier={tier} count={totalCount} />

        {/* ── Tabs ── */}
        <div className="listings__tabs" role="tablist">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`listings__tab${
                tab === t.key ? " listings__tab--active" : ""
              }`}
              onClick={() => onTabChange?.(t.key)}
            >
              {t.label}
              <span className="listings__tab-count">
                {tabCounts[t.key] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* ── Search ── */}
        <div className="listings__search">
          <Ic.Search />
          <input
            type="search"
            className="listings__search-input"
            placeholder="Search your listings…"
            value={search}
            onChange={(e) => onSearch?.(e.target.value)}
          />
          {search && (
            <button
              className="listings__search-clear"
              onClick={() => onSearch?.("")}
              aria-label="Clear search"
            >
              <Ic.X />
            </button>
          )}
        </div>

        {/* ── Tab banners ── */}
        <TabInfoBanner tab={tab} tier={tier} hasProducts={hasProducts} />

        {/* ── Skeleton ── */}
        {prodLoading && <ProdSkeleton />}

        {/* ── Empty ── */}
        {!prodLoading && products.length === 0 && (
          <EmptyState
            icon={<Ic.Package />}
            title={emptyTitle(tab, search)}
            description={emptyDescription(tab, search)}
            action={
              !search && (tab === "all" || tab === "active")
                ? "Create Listing"
                : null
            }
            onAction={() => onNavigate?.("/minimart/add")}
          />
        )}

        {/* ── Product list ── */}
        {hasProducts && (
          <div className="listings__list">
            {products.map((p) => (
              <ProductRow
                key={p?.id ?? Math.random()}
                product={p}
                tier={tier}
                isSubscriber={isSubscriber}
                isDeleting={deleting  === p?.id}
                isVerifying={verifying === p?.id}
                isRenewing={renewing  === p?.id}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggle={onToggle}
                onRenew={onRenew}
                onPromote={onPromote}
                onPayNow={onPayNow}
                onVerifyPayment={onVerifyPayment}
              />
            ))}
          </div>
        )}

        {/* ── Load more ── */}
        {!prodLoading && hasMore && (
          <div className="listings__load-more">
            <button
              className="btn btn--ghost"
              onClick={() => onLoadMore?.()}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <><span className="spinner" /> Loading…</>
              ) : (
                "Load More"
              )}
            </button>
          </div>
        )}

        {/* ── Count ── */}
        {hasProducts && (
          <p className="listings__count">
            Showing {products.length} listing
            {products.length !== 1 ? "s" : ""}
            {search ? ` matching "${search}"` : ""}
          </p>
        )}

      </div>
    </div>
  );
}