// DropdownModal.jsx
import React, {
  useState, useRef, useEffect, useCallback, useMemo, useId,
} from "react";
import "./DropdownModal.css";

export default function DropdownModal({
  label       = "",
  value       = "",
  onChange,
  options     = [],
  idField     = "id",
  labelField  = "name",
  placeholder,
  disabled    = false,
  searchable  = true,   // show search box when options > 6
  maxHeight   = 260,    // px
}) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState("");

  const containerRef = useRef(null);
  const searchRef    = useRef(null);
  const listRef      = useRef(null);
  const uid          = useId(); // unique ID for a11y

  // ── Helpers ────────────────────────────────────────────
  const norm = (v) =>
    v !== null && v !== undefined ? String(v).trim() : "";

  const getOptValue = (opt) =>
    typeof opt === "object" ? norm(opt[idField])   : norm(opt);

  const getOptLabel = (opt) =>
    typeof opt === "object" ? opt[labelField] ?? "" : opt ?? "";

  const getOptDisabled = (opt) =>
    typeof opt === "object" ? !!opt.disabled : false;

  // ── Filtered options ───────────────────────────────────
  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((opt) =>
      getOptLabel(opt).toLowerCase().includes(q)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, query]);

  // ── Display value ──────────────────────────────────────
  const displayValue = useMemo(() => {
    if (!value) return "";
    const found = options.find((opt) => getOptValue(opt) === norm(value));
    return found ? getOptLabel(found) : "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options]);

  const showPlaceholder = !displayValue;
  const placeholderText = placeholder || (label ? `Select ${label}` : "Select an option");

  // ── Show search when options > 6 ───────────────────────
  const showSearch = searchable && options.length > 6;

  // ── Open / close ───────────────────────────────────────
  const openDropdown = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    // Focus search input on next tick
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [disabled]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const toggle = useCallback(() => {
    open ? closeDropdown() : openDropdown();
  }, [open, openDropdown, closeDropdown]);

  // ── Close on outside click / Escape ───────────────────
  useEffect(() => {
    if (!open) return;

    const onMouseDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target))
        closeDropdown();
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeDropdown();
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown",   onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown",   onKeyDown);
    };
  }, [open, closeDropdown]);

  // ── Scroll selected option into view on open ──────────
  useEffect(() => {
    if (!open || !listRef.current) return;
    const selected = listRef.current.querySelector(".dm-option.selected");
    selected?.scrollIntoView({ block: "nearest" });
  }, [open, filteredOptions]);

  // ── Select ─────────────────────────────────────────────
  const handleSelect = useCallback((opt) => {
    if (getOptDisabled(opt)) return;
    onChange?.(getOptValue(opt));
    closeDropdown();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, closeDropdown]);

  // ── Keyboard navigation inside list ───────────────────
  const handleListKeyDown = useCallback((e) => {
    const items = listRef.current?.querySelectorAll(".dm-option:not(.dm-option--disabled)");
    if (!items?.length) return;

    const active = listRef.current.querySelector(".dm-option:focus");
    const idx    = Array.from(items).indexOf(active);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[Math.min(idx + 1, items.length - 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx <= 0) { searchRef.current?.focus(); }
      else { items[idx - 1]?.focus(); }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      active?.click();
    }
  }, []);

  // ── Trigger keyboard navigation from search ────────────
  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const first = listRef.current?.querySelector(".dm-option:not(.dm-option--disabled)");
      first?.focus();
    }
  }, []);

  // ── Render ─────────────────────────────────────────────
  return (
    <div
      className={[
        "dm",
        open     ? "dm--open"     : "",
        disabled ? "dm--disabled" : "",
      ].filter(Boolean).join(" ")}
      ref={containerRef}
    >
      {/* Optional label */}
      {label && (
        <label className="dm-label" htmlFor={uid}>
          {label}
        </label>
      )}

      {/* Trigger button */}
      <button
        id={uid}
        type="button"
        className="dm-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled}
        onClick={toggle}
        disabled={disabled}
      >
        <span className={`dm-trigger-text ${showPlaceholder ? "dm-placeholder" : ""}`}>
          {showPlaceholder ? placeholderText : displayValue}
        </span>
        <span className="dm-chevron" aria-hidden="true">
          <svg viewBox="0 0 12 8" width="12" height="8" fill="none">
            <path
              d="M1 1.5L6 6.5L11 1.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="dm-panel"
          role="listbox"
          aria-label={label || "Options"}
          style={{ maxHeight }}
          onKeyDown={handleListKeyDown}
        >
          {/* Search */}
          {showSearch && (
            <div className="dm-search-wrap">
              <span className="dm-search-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
              <input
                ref={searchRef}
                type="text"
                className="dm-search"
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                aria-label="Search options"
              />
              {query && (
                <button
                  type="button"
                  className="dm-search-clear"
                  aria-label="Clear search"
                  onClick={() => { setQuery(""); searchRef.current?.focus(); }}
                >
                  &#215;
                </button>
              )}
            </div>
          )}

          {/* Option list */}
          <div className="dm-list" ref={listRef}>
            {filteredOptions.length === 0 ? (
              <div className="dm-empty">
                {query ? `No results for "${query}"` : "No options available"}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const optVal      = getOptValue(opt);
                const optLabel    = getOptLabel(opt);
                const isSelected  = norm(value) === optVal;
                const isDisabled  = getOptDisabled(opt);

                return (
                  <div
                    key={optVal || optLabel}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={isDisabled}
                    tabIndex={isDisabled ? -1 : 0}
                    className={[
                      "dm-option",
                      isSelected ? "selected"          : "",
                      isDisabled ? "dm-option--disabled" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => handleSelect(opt)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelect(opt);
                      }
                    }}
                  >
                    <span className="dm-option-label">{optLabel}</span>
                    {isSelected && (
                      <span className="dm-option-check" aria-hidden="true">
                        <svg viewBox="0 0 12 10" width="12" height="10" fill="none">
                          <path
                            d="M1 5l3.5 3.5L11 1"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}