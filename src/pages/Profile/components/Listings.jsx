// src/pages/Profile/components/Listings.jsx
import { Ic } from "./icons";
import ProductCard from "./ProductCard";
import EmptyState from "./EmptyState";
import { ProdSkeleton } from "./Skeletons";
import "./Listings.css";

const TABS = [
  { key: "all",     label: "All" },
  { key: "active",  label: "Active" },
  { key: "draft",   label: "Drafts" },
  { key: "paused",  label: "Paused" },
  { key: "pending", label: "Pending" },
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
  return (
    <div className="listings">
      <div className="listings__card">

        {/* ── Header ── */}
        <div className="listings__header">
          <h2 className="listings__title">My Listings</h2>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => onNavigate("/minimart/add")}
          >
            <Ic.Plus /> Add New
          </button>
        </div>

        {/* ── Filter Tabs ── */}
        <div className="listings__tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
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
                : `No ${tab === "all" ? "" : tab + " "}listings`
            }
            description={
              search
                ? "Try a different search term."
                : tab === "pending"
                ? "All your listings are paid up!"
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