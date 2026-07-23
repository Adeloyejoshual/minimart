// src/pages/Profile/components/Listings.jsx
import { Link } from "react-router-dom";
import { Ic } from "./icons";
import ProductCard from "./ProductCard";
import EmptyState from "./EmptyState";
import { ProdSkeleton } from "./Skeletons";
import "./Listings.css";

const TABS = [
  { key: "all",             label: "All"       },
  { key: "active",          label: "Active"    },
  { key: "active_limited",  label: "Trial"     },
  { key: "draft",           label: "Drafts"    },
  { key: "paused",          label: "Paused"    },
  { key: "pending",         label: "Pending"   },
];

export default function Listings({
  products,
  prodLoading,
  loadingMore,
  hasMore,
  tab,
  search,
  tabCounts,
  deleting,
  verifying,
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
  /* Only show 'Trial' tab if user has trial listings OR is unverified */
  const visibleTabs = TABS.filter((t) => {
    if (t.key === "active_limited") {
      return (tabCounts[t.key] ?? 0) > 0 || tier === "unverified";
    }
    return true;
  });

  return (
    <div className="listings">
      <div className="listings__card">

        {/* ── Header ── */}
        <div className="listings__header">
          <div className="listings__header-left">
            <h2 className="listings__title">My Listings</h2>

            {/* Tier indicator next to title */}
            {tier === "subscriber" && (
              <span className="listings__tier-badge listings__tier-badge--pro">
                <Ic.Zap /> Pro
              </span>
            )}
            {tier === "verified" && (
              <span className="listings__tier-badge listings__tier-badge--verified">
                <Ic.CheckCircle /> Verified
              </span>
            )}
            {tier === "unverified" && (
              <span className="listings__tier-badge listings__tier-badge--trial">
                <Ic.Clock /> Trial
              </span>
            )}
          </div>

          <button
            className="btn btn--primary btn--sm"
            onClick={() => onNavigate("/minimart/add")}
          >
            <Ic.Plus /> Add New
          </button>
        </div>

        {/* ── Upsell banner for unverified/verified at cap ── */}
        {tier === "unverified" && (tabCounts.all ?? 0) >= 2 && (
          <div className="listings__upsell-banner listings__upsell-banner--verify">
            <Ic.Shield />
            <div className="listings__upsell-text">
              <strong>Upgrade to Verified</strong>
              <p>
                You've used {tabCounts.all ?? 0} of 3 trial listings.
                Verify your identity to unlock 500 free listings + 30-day windows.
              </p>
            </div>
            <Link to="/verification" className="btn btn--primary btn--sm">
              Verify Now
            </Link>
          </div>
        )}

        {tier === "verified" && (tabCounts.all ?? 0) >= 450 && (
          <div className="listings__upsell-banner listings__upsell-banner--subscribe">
            <Ic.Zap />
            <div className="listings__upsell-text">
              <strong>Approaching your 500-listing limit</strong>
              <p>
                You've used {tabCounts.all ?? 0} of 500 free listings.
                Subscribe to Pro for unlimited posting.
              </p>
            </div>
            <Link to="/seller/subscription/plans" className="btn btn--primary btn--sm">
              View Plans
            </Link>
          </div>
        )}

        {/* ── Filter Tabs ── */}
        <div className="listings__tabs" role="tablist">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`listings__tab${
                tab === t.key ? " listings__tab--active" : ""
              }`}
              onClick={() => onTabChange(t.key)}
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
            onChange={(e) => onSearch(e.target.value)}
          />
          {search && (
            <button
              className="listings__search-clear"
              onClick={() => onSearch("")}
              aria-label="Clear search"
            >
              <Ic.X />
            </button>
          )}
        </div>

        {/* ── Trial Tab Info Banner ── */}
        {tab === "active_limited" && !prodLoading && products.length > 0 && (
          <div className="listings__info-banner listings__info-banner--trial">
            <Ic.Clock />
            <div>
              <strong>Trial listings expire in 7 days</strong>
              <p>
                {tier === "unverified"
                  ? "Verify your identity to make these listings permanent (30 days for verified, 90 days for Pro)."
                  : "Tap 'Activate' on any listing to convert it to a full listing."}
              </p>
            </div>
            {tier === "unverified" && (
              <Link to="/verification" className="btn btn--primary btn--sm">
                Verify
              </Link>
            )}
          </div>
        )}

        {/* ── Pending Payment Info Banner ── */}
        {tab === "pending" && !prodLoading && products.length > 0 && (
          <div className="listings__info-banner">
            <Ic.AlertCircle />
            <div>
              <strong>Payment required</strong>
              <p>
                These listings are waiting for payment to go live.
                Complete payment to activate them.
              </p>
            </div>
          </div>
        )}

        {/* ── Paused Tab — renewal hint ── */}
        {tab === "paused" && !prodLoading && products.length > 0 && tier === "unverified" && (
          <div className="listings__info-banner listings__info-banner--warn">
            <Ic.AlertCircle />
            <div>
              <strong>Paused listings can't be reactivated</strong>
              <p>
                Trial listings that expire become paused. Verify your identity to unlock reactivation.
              </p>
            </div>
            <Link to="/verification" className="btn btn--primary btn--sm">
              Verify
            </Link>
          </div>
        )}

        {/* ── Loading ── */}
        {prodLoading && <ProdSkeleton />}

        {/* ── Empty State ── */}
        {!prodLoading && products.length === 0 && (
          <EmptyState
            icon={<Ic.Search />}
            title={
              search
                ? `No results for "${search}"`
                : tab === "pending"
                ? "No pending payments"
                : tab === "active_limited"
                ? "No trial listings"
                : `No ${tab === "all" ? "" : tab + " "}listings`
            }
            description={
              search
                ? "Try a different search term."
                : tab === "pending"
                ? "All your listings are paid up!"
                : tab === "active_limited"
                ? "You don't have any trial listings right now."
                : "Start selling by creating your first listing."
            }
            action={
              !search && (tab === "all" || tab === "active")
                ? "Create Listing"
                : null
            }
            onAction={() => onNavigate("/minimart/add")}
          />
        )}

        {/* ── Product List ── */}
        {!prodLoading && products.length > 0 && (
          <div className="listings__list">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                tier={tier}
                isSubscriber={isSubscriber}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggle={onToggle}
                onRenew={onRenew}
                onPromote={onPromote}
                onPayNow={onPayNow}
                onVerifyPayment={onVerifyPayment}
                isDeleting={deleting === p.id}
                isVerifying={verifying === p.id}
              />
            ))}
          </div>
        )}

        {/* ── Load More ── */}
        {!prodLoading && hasMore && (
          <div className="listings__load-more">
            <button
              className="btn btn--ghost"
              onClick={onLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <span className="spinner" /> Loading…
                </>
              ) : (
                "Load More"
              )}
            </button>
          </div>
        )}

        {/* ── Count ── */}
        {!prodLoading && products.length > 0 && (
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