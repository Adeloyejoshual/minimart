import React, { memo } from "react";
import { CURRENCY } from "../../config/marketplace";
import { FilterIcon, CloseIcon } from "./icons";

const FilterDrawer = memo(function FilterDrawer({
  minPrice, setMinPrice,
  maxPrice, setMaxPrice,
  sortOptions, sort, setSort,
  onClear, onApply,
}) {
  return (
    <>
      <div className="mp-overlay" onClick={onApply} />
      <div className="mp-drawer" role="dialog" aria-label="Filter products">
        <div className="mp-drawer-handle" />

        <div className="mp-drawer-header">
          <h2 className="mp-drawer-title"><FilterIcon size={17} /> Filters</h2>
          <button className="mp-drawer-close" onClick={onApply} aria-label="Close filters">
            <CloseIcon size={13} />
          </button>
        </div>

        <div className="mp-filter-section">
          <div className="mp-filter-label">Sort By</div>
          <div className="mp-filter-chips">
            {sortOptions.map((s) => (
              <button
                key={s.value}
                className={`mp-chip ${sort === s.value ? "mp-chip--active" : ""}`}
                onClick={() => setSort(s.value)}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mp-filter-section">
          <div className="mp-filter-label">Price Range ({CURRENCY})</div>
          <div className="mp-price-range">
            <div className="mp-price-input-wrap">
              <span className="mp-price-symbol">{CURRENCY}</span>
              <input
                className="mp-price-input"
                type="number" inputMode="numeric"
                placeholder="Min" value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
            </div>
            <span className="mp-price-sep">—</span>
            <div className="mp-price-input-wrap">
              <span className="mp-price-symbol">{CURRENCY}</span>
              <input
                className="mp-price-input"
                type="number" inputMode="numeric"
                placeholder="Max" value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mp-drawer-footer">
          <button className="mp-btn-clear" onClick={onClear}>Clear All</button>
          <button className="mp-btn-apply" onClick={onApply}>Show Results</button>
        </div>
      </div>
    </>
  );
});

export default FilterDrawer;