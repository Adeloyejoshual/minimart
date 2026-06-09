import React, { memo } from "react";
import { ChevDownIcon, ChevUpIcon, Grid2Icon, Grid3Icon, ListIcon } from "./icons";

const VIEW_MODES = [
  { mode: "grid2", Icon: Grid2Icon, label: "2-column grid" },
  { mode: "grid3", Icon: Grid3Icon, label: "3-column grid" },
  { mode: "list",  Icon: ListIcon,  label: "List view"     },
];

const SubBar = memo(function SubBar({
  total, loading, search,
  sort, sortOptions, showSort, sortRef,
  onToggleSort, onSort,
  viewMode, onViewMode,
}) {
  const activeSort = sortOptions.find((s) => s.value === sort);

  return (
    <div className="mp-subbar">
      <div className="mp-subbar-left">
        {loading ? (
          <span className="mp-count-loading">Loading…</span>
        ) : total > 0 ? (
          <span className="mp-count">
            <strong>{total.toLocaleString()}</strong> products
            {search && <> for "<em>{search}</em>"</>}
          </span>
        ) : null}
      </div>

      <div className="mp-subbar-right">
        <div className="mp-sort-wrap" ref={sortRef}>
          <button
            className="mp-sort-btn"
            onClick={onToggleSort}
            aria-haspopup="listbox"
            aria-expanded={showSort}
          >
            <span>{activeSort?.icon} {activeSort?.label}</span>
            <span className="mp-sort-chevron">
              {showSort ? <ChevUpIcon size={13} /> : <ChevDownIcon size={13} />}
            </span>
          </button>

          {showSort && (
            <div className="mp-sort-menu" role="listbox" aria-label="Sort options">
              {sortOptions.map((s) => (
                <button
                  key={s.value}
                  className={`mp-sort-item ${sort === s.value ? "mp-sort-item--active" : ""}`}
                  role="option"
                  aria-selected={sort === s.value}
                  onClick={() => onSort(s.value)}
                >
                  <span>{s.icon} {s.label}</span>
                  {sort === s.value && <span className="mp-sort-check">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mp-view-toggle" role="group" aria-label="View mode">
          {VIEW_MODES.map(({ mode, Icon, label }) => (
            <button
              key={mode}
              className={`mp-view-btn ${viewMode === mode ? "mp-view-btn--active" : ""}`}
              onClick={() => onViewMode(mode)}
              aria-label={label}
              aria-pressed={viewMode === mode}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

export default SubBar;