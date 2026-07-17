// src/desktop/components/DeskListings.tsx

import { Ic } from "../../pages/Profile/components/icons";
import ProductRow from "./ProductRow";

interface TabCount {
  all: number;
  active: number;
  draft: number;
  paused: number;
  pending: number;
}

interface DeskListingsProps {
  products: any[];
  prodLoading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  tab: string;
  search: string;
  tabCounts: TabCount;
  deleting: string | null;
  onTabChange: (t: string) => void;
  onSearch: (v: string) => void;
  onLoadMore: () => void;
  onNavigate: (path: string) => void;
  onEdit: (p: any) => void;
  onDelete: (p: any) => void;
  onToggle: (p: any) => void;
  onRenew: (p: any) => void;
  onPromote: (p: any) => void;
}

const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Drafts" },
  { key: "paused", label: "Paused" },
  { key: "pending", label: "Pending" },
];

export default function DeskListings({
  products,
  prodLoading,
  loadingMore,
  hasMore,
  tab,
  search,
  tabCounts,
  deleting,
  onTabChange,
  onSearch,
  onLoadMore,
  onNavigate,
  onEdit,
  onDelete,
  onToggle,
  onRenew,
  onPromote,
}: DeskListingsProps) {
  return (
    <div className="dkd-listings">
      <div className="dkd-card">
        {/* Header */}
        <div className="dkd-card-header">
          <h2>My Listings</h2>
          <button
            className="dkd-btn dkd-btn--primary"
            onClick={() => onNavigate("/minimart/add")}
          >
            <Ic.Plus /> Add New Listing
          </button>
        </div>

        {/* Tabs + Search row */}
        <div className="dkd-listings-controls">
          <div className="dkd-filter-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`dkd-filter-tab${
                  tab === t.key ? " dkd-filter-tab--active" : ""
                }`}
                onClick={() => onTabChange(t.key)}
              >
                {t.label}
                <span className="dkd-filter-count">
                  {tabCounts[t.key as keyof TabCount] ?? 0}
                </span>
              </button>
            ))}
          </div>

          <div className="dkd-listings-search">
            <Ic.Search />
            <input
              type="search"
              placeholder="Search listings…"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
            {search && (
              <button
                className="dkd-search-clear"
                onClick={() => onSearch("")}
              >
                <Ic.X />
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {prodLoading && (
          <div className="dkd-table-skeleton">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="dkd-skeleton"
                style={{ height: 56, borderRadius: 8, marginBottom: 6 }}
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!prodLoading && products.length === 0 && (
          <div className="dkd-empty">
            <div className="dkd-empty-icon">
              <Ic.Search />
            </div>
            <h3>
              {search
                ? `No results for "${search}"`
                : `No ${tab === "all" ? "" : tab + " "}listings`}
            </h3>
            <p>
              {search
                ? "Try a different search term."
                : "Start selling by creating your first listing."}
            </p>
            {!search && tab === "all" && (
              <button
                className="dkd-btn dkd-btn--primary"
                onClick={() => onNavigate("/minimart/add")}
              >
                Create Listing
              </button>
            )}
          </div>
        )}

        {/* Table */}
        {!prodLoading && products.length > 0 && (
          <div className="dkd-table-wrap">
            <table className="dkd-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Views</th>
                  <th>Saves</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p: any) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggle={onToggle}
                    onRenew={onRenew}
                    onPromote={onPromote}
                    isDeleting={deleting === p.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Load more */}
        {!prodLoading && hasMore && (
          <div className="dkd-load-more">
            <button
              className="dkd-btn dkd-btn--ghost"
              onClick={onLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <span className="dkd-spinner" /> Loading…
                </>
              ) : (
                "Load More"
              )}
            </button>
          </div>
        )}

        {!prodLoading && products.length > 0 && (
          <p className="dkd-results-count">
            Showing {products.length} listing
            {products.length !== 1 ? "s" : ""}
            {search ? ` matching "${search}"` : ""}
          </p>
        )}
      </div>
    </div>
  );
}