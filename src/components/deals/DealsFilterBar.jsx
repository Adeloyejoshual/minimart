// src/components/deals/DealsFilterBar.jsx
import { memo } from "react";

const PRICE_OPTIONS = [
  { label: "All Deals",    value: ""      },
  { label: "Under ₦5k",   value: "5000"  },
  { label: "Under ₦10k",  value: "10000" },
  { label: "Under ₦20k",  value: "20000" },
  { label: "Under ₦50k",  value: "50000" },
];

const SORT_OPTIONS = [
  { label: "Lowest Price", value: "price_asc"       },
  { label: "Most Popular", value: "engagement_desc" },
  { label: "Newest",       value: "created_desc"    },
  { label: "Best Discount",value: "discount_desc"   },
];

const DealsFilterBar = memo(function DealsFilterBar({
  maxPrice,
  sortBy,
  onMaxPriceChange,
  onSortChange,
  total,
}) {
  return (
    <div className="df-bar" role="toolbar" aria-label="Filter deals">
      {/* Result count */}
      {total > 0 && (
        <span className="df-count">
          {total.toLocaleString()} deal{total !== 1 ? "s" : ""}
        </span>
      )}

      <div className="df-controls">
        {/* Price filter */}
        <div className="df-select-wrap">
          <label htmlFor="df-price" className="df-label">Price</label>
          <select
            id="df-price"
            className="df-select"
            value={maxPrice}
            onChange={(e) => onMaxPriceChange(e.target.value)}
          >
            {PRICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="df-select-wrap">
          <label htmlFor="df-sort" className="df-label">Sort</label>
          <select
            id="df-sort"
            className="df-select"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
});

export default DealsFilterBar;