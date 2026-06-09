import React, { memo } from "react";
import { useNavigate } from "react-router-dom";
import CategoryBar from "./CategoryBar";
import { SearchIcon, CloseIcon, FilterIcon, PlusIcon } from "./icons";

const TopBar = memo(function TopBar({
  user,
  search, onSearch,
  category, onCategory,
  activeFiltersCount,
  onOpenFilter,
  searchRef,
}) {
  const navigate = useNavigate();

  return (
    <header className="mp-topbar" role="banner">
      <div className="mp-topbar-row">
        <button
          className="mp-logo"
          onClick={() => { onSearch(""); onCategory(""); window.scrollTo(0, 0); }}
          aria-label="Minimart home"
        >
          Minimart
        </button>

        <div className="mp-search-wrap">
          <span className="mp-search-ico" aria-hidden="true"><SearchIcon size={16} /></span>
          <input
            ref={searchRef}
            className="mp-search"
            type="search"
            placeholder="Search products, brands…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            aria-label="Search products"
          />
          {search && (
            <button
              className="mp-search-clear"
              onClick={() => { onSearch(""); searchRef.current?.focus(); }}
              aria-label="Clear search"
            >
              <CloseIcon size={12} />
            </button>
          )}
        </div>

        <div className="mp-topbar-actions">
          <button
            className={`mp-icon-btn ${activeFiltersCount ? "mp-icon-btn--active" : ""}`}
            onClick={onOpenFilter}
            aria-label={`Filters${activeFiltersCount ? ` (${activeFiltersCount} active)` : ""}`}
          >
            <FilterIcon size={17} />
            {activeFiltersCount > 0 && (
              <span className="mp-badge-dot">{activeFiltersCount}</span>
            )}
          </button>

          <button
            className="mp-post-btn"
            onClick={() => navigate(user ? "/minimart/post-ad" : "/auth")}
          >
            <PlusIcon size={15} />
            <span className="mp-post-label">Post Ad</span>
          </button>
        </div>
      </div>

      <CategoryBar active={category} onChange={onCategory} />
    </header>
  );
});

export default TopBar;