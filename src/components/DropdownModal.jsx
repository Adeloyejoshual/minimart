// src/components/DropdownModal.jsx
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useId,
} from "react";
import { createPortal } from "react-dom";
import "./DropdownModal.css";

/* ── Pure helpers ─────────────────────────────────────────────── */
const normValue = (v) =>
  v !== null && v !== undefined ? String(v).trim() : "";

const getOptValue = (opt, idField) =>
  typeof opt === "object" ? normValue(opt[idField]) : normValue(opt);

const getOptLabel = (opt, labelField) =>
  typeof opt === "object" ? String(opt[labelField] ?? "") : String(opt ?? "");

const getOptDisabled = (opt) =>
  typeof opt === "object" ? !!opt.disabled : false;

/* ── Component ────────────────────────────────────────────────── */
export default function DropdownModal({
  label      = "",
  value      = "",
  onChange,
  options    = [],
  idField    = "id",
  labelField = "name",
  placeholder,
  disabled   = false,
  searchable = true,
  maxHeight  = 260,
  loading    = false,
}) {
  const [open,         setOpen]         = useState(false);
  const [rawQuery,     setRawQuery]     = useState("");
  const [query,        setQuery]        = useState("");
  const [dropUp,       setDropUp]       = useState(false);
  const [focusedOptId, setFocusedOptId] = useState(null);
  const [panelStyle,   setPanelStyle]   = useState(null);

  const rootRef      = useRef(null);
  const triggerRef   = useRef(null);
  const panelRef     = useRef(null);
  const searchRef    = useRef(null);
  const listRef      = useRef(null);
  const debounceRef  = useRef(null);
  const rafRef       = useRef(null);

  const uid      = useId();
  const panelId  = `${uid}-panel`;

  /* ── Derived ── */
  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((opt) =>
      getOptLabel(opt, labelField).toLowerCase().includes(q)
    );
  }, [options, query, labelField]);

  const displayValue = useMemo(() => {
    if (!value) return "";
    const found = options.find(
      (opt) => getOptValue(opt, idField) === normValue(value)
    );
    return found ? getOptLabel(found, labelField) : "";
  }, [value, options, idField, labelField]);

  const showPlaceholder = !displayValue;
  const placeholderText =
    placeholder || (label ? `Select ${label}` : "Select an option");
  const showSearch = searchable && options.length > 6;

  const truncatedQuery = rawQuery.length > 30
    ? `${rawQuery.slice(0, 30)}…`
    : rawQuery;

  /* ── Positioning (portal panel) ── */
  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const gap = 8;
    const viewportPad = 8;
    const desiredHeight = Math.min(maxHeight, 320);

    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPad;
    const spaceAbove = rect.top - gap - viewportPad;

    const shouldDropUp =
      spaceBelow < desiredHeight && spaceAbove > spaceBelow;

    const availableHeight = shouldDropUp
      ? Math.max(140, spaceAbove)
      : Math.max(140, spaceBelow);

    const panelHeight = Math.min(desiredHeight, availableHeight);

    const width = Math.max(rect.width, 180);
    const left = Math.min(
      Math.max(viewportPad, rect.left),
      window.innerWidth - width - viewportPad
    );

    const top = shouldDropUp
      ? Math.max(viewportPad, rect.top - panelHeight - gap)
      : Math.min(
          window.innerHeight - panelHeight - viewportPad,
          rect.bottom + gap
        );

    setDropUp(shouldDropUp);
    setPanelStyle({
      position  : "fixed",
      top       : `${top}px`,
      left      : `${left}px`,
      width     : `${width}px`,
      maxHeight : `${panelHeight}px`,
      zIndex    : 10000,
    });
  }, [maxHeight]);

  /* ── Open / close ── */
  const closeDropdown = useCallback(() => {
    setOpen(false);
    setRawQuery("");
    setQuery("");
    setFocusedOptId(null);
    setPanelStyle(null);
    cancelAnimationFrame(rafRef.current);
  }, []);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setRawQuery("");
    setQuery("");
    setFocusedOptId(null);
  }, [disabled]);

  const toggle = useCallback(() => {
    open ? closeDropdown() : openDropdown();
  }, [open, openDropdown, closeDropdown]);

  /* ── Reposition while open ── */
  useEffect(() => {
    if (!open) return;

    const run = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updatePanelPosition);
    };

    run();

    window.addEventListener("resize", run);
    window.addEventListener("scroll", run, true);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", run);
      window.removeEventListener("scroll", run, true);
    };
  }, [open, updatePanelPosition]);

  /* ── Focus on open ── */
  useEffect(() => {
    if (!open) return;

    const tid = setTimeout(() => {
      if (showSearch) {
        searchRef.current?.focus();
      } else {
        const selected =
          listRef.current?.querySelector(".dm-option.selected") ||
          listRef.current?.querySelector(".dm-option:not(.dm-option--disabled)");
        selected?.focus();
      }
    }, 0);

    return () => clearTimeout(tid);
  }, [open, showSearch, filteredOptions.length]);

  /* ── Outside click / touch / Escape ── */
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e) => {
      const insideRoot  = rootRef.current?.contains(e.target);
      const insidePanel = panelRef.current?.contains(e.target);
      if (!insideRoot && !insidePanel) {
        closeDropdown();
      }
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        closeDropdown();
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeDropdown]);

  /* ── Scroll selected into view ── */
  useEffect(() => {
    if (!open || !listRef.current) return;
    const selected = listRef.current.querySelector(".dm-option.selected");
    selected?.scrollIntoView({ block: "nearest" });
  }, [open, filteredOptions]);

  /* ── Debounced search ── */
  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    setRawQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => setQuery(val),
      options.length > 100 ? 150 : 0
    );
  }, [options.length]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  /* ── Select ── */
  const handleSelect = useCallback((opt) => {
    if (getOptDisabled(opt)) return;
    onChange?.(getOptValue(opt, idField));
    closeDropdown();
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [onChange, closeDropdown, idField]);

  /* ── Keyboard navigation ── */
  const focusFirstEnabled = useCallback(() => {
    const first = listRef.current?.querySelector(
      ".dm-option:not(.dm-option--disabled)"
    );
    first?.focus();
  }, []);

  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusFirstEnabled();
    }
  }, [focusFirstEnabled]);

  const handleListKeyDown = useCallback((e) => {
    const items = listRef.current?.querySelectorAll(
      ".dm-option:not(.dm-option--disabled)"
    );
    if (!items?.length) return;

    const list = Array.from(items);
    const active = document.activeElement;
    const idx = list.indexOf(active);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (idx < 0) list[0]?.focus();
      else list[Math.min(idx + 1, list.length - 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx <= 0) {
        if (showSearch) searchRef.current?.focus();
        else triggerRef.current?.focus();
      } else {
        list[idx - 1]?.focus();
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      active?.click();
    } else if (e.key === "Tab") {
      closeDropdown();
    }
  }, [closeDropdown, showSearch]);

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /* ── Panel (rendered in portal) ── */
  const panel = open && typeof document !== "undefined" && panelStyle
    ? createPortal(
        <div
          ref={panelRef}
          id={panelId}
          className={`dm-panel${dropUp ? " dm-panel--up" : ""}`}
          role="listbox"
          aria-label={label || placeholderText}
          aria-activedescendant={focusedOptId ?? undefined}
          style={panelStyle}
          onKeyDown={handleListKeyDown}
        >
          {showSearch && (
            <div className="dm-search-wrap">
              <span className="dm-search-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6"/>
                  <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </span>
              <input
                ref={searchRef}
                type="text"
                className="dm-search"
                placeholder="Search…"
                value={rawQuery}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                aria-label="Search options"
                autoComplete="off"
                spellCheck={false}
              />
              {rawQuery && (
                <button
                  type="button"
                  className="dm-search-clear"
                  aria-label="Clear search"
                  onClick={() => {
                    setRawQuery("");
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                >
                  <svg viewBox="0 0 12 12" width="9" height="9" fill="none"
                       stroke="currentColor" strokeWidth="2.2"
                       strokeLinecap="round" aria-hidden="true">
                    <line x1="1" y1="1" x2="11" y2="11"/>
                    <line x1="11" y1="1" x2="1" y2="11"/>
                  </svg>
                </button>
              )}
            </div>
          )}

          <div className="dm-list" ref={listRef}>
            {loading ? (
              <div className="dm-loading" aria-live="polite">
                <span className="dm-spinner" aria-hidden="true" />
                Loading options…
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="dm-empty" role="status" aria-live="polite">
                {rawQuery
                  ? `No results for "${truncatedQuery}"`
                  : "No options available"}
              </div>
            ) : (
              filteredOptions.map((opt, index) => {
                const optVal     = getOptValue(opt, idField);
                const optLabel   = getOptLabel(opt, labelField);
                const isSelected = normValue(value) === optVal;
                const isDisabled = getOptDisabled(opt);
                const optId      = `${uid}-opt-${optVal !== "" ? optVal : index}`;

                return (
                  <div
                    key={optVal !== "" ? optVal : `opt-${index}`}
                    id={optId}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={isDisabled || undefined}
                    tabIndex={isDisabled ? -1 : 0}
                    className={[
                      "dm-option",
                      isSelected ? "selected" : "",
                      isDisabled ? "dm-option--disabled" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => handleSelect(opt)}
                    onFocus={() => setFocusedOptId(optId)}
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
                          <path d="M1 5l3.5 3.5L11 1"
                                stroke="currentColor" strokeWidth="1.8"
                                strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  /* ── Render ── */
  return (
    <>
      <div
        className={[
          "dm",
          open     ? "dm--open"     : "",
          disabled ? "dm--disabled" : "",
        ].filter(Boolean).join(" ")}
        ref={rootRef}
      >
        {label && (
          <label className="dm-label" htmlFor={uid}>
            {label}
          </label>
        )}

        <button
          ref={triggerRef}
          id={uid}
          type="button"
          className="dm-trigger"
          aria-haspopup="listbox"
          aria-controls={open ? panelId : undefined}
          aria-expanded={open ? "true" : "false"}
          aria-disabled={disabled}
          onClick={toggle}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!open) openDropdown();
            }
          }}
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
      </div>

      {panel}
    </>
  );
}