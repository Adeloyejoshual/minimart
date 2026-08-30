/**
 * src/pages/PostAds/CategoryPicker.jsx
 *
 * Hierarchical category drill-down picker.
 *
 * Fetches: GET /api/categories
 * Falls back to: CATEGORIES_FALLBACK if API fails
 * Renders: L1 column → L2 column → L3 column (Jumia-style)
 */

import { useEffect, useState, useCallback, useMemo, memo } from "react";
import axios from "axios";
import { CATEGORIES_FALLBACK } from "../../config/categories";

/* ═══════════════════════════════════════════════════════════════
   API URL SANITIZATION
═══════════════════════════════════════════════════════════════ */
const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const BASE     = RAW_BASE.replace(/\/+$/, "");
const API_URL  = `${BASE}/api/categories`;

/* ═══════════════════════════════════════════════════════════════
   ICONS & SPINNER
═══════════════════════════════════════════════════════════════ */
const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const Spinner = () => (
  <div className="cp-spinner" role="status" aria-label="Loading categories">
    <div className="cp-spinner-ring" />
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   TREE BUILDER
   Transforms a flat list (e.g. from SQL) into a nested tree
═══════════════════════════════════════════════════════════════ */
function buildTree(items) {
  if (!Array.isArray(items) || items.length === 0) return [];

  // Check if items already have children populated
  const hasPrebuiltChildren = items.some(
    (item) => Array.isArray(item.children) && item.children.length > 0
  );

  if (hasPrebuiltChildren) {
    return items.filter((item) => !item.parent_id);
  }

  const map = {};
  const roots = [];

  // Clone items to avoid mutating originals
  items.forEach((item) => {
    map[item.id] = { ...item, children: [] };
  });

  items.forEach((item) => {
    if (item.parent_id && map[item.parent_id]) {
      map[item.parent_id].children.push(map[item.id]);
    } else {
      roots.push(map[item.id]);
    }
  });

  return roots;
}

function buildPath(node, parentPath = []) {
  return [...parentPath, node.name];
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */
const CategoryPicker = memo(function CategoryPicker({ value, onSelect, error }) {
  const [tree,       setTree]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchErr,   setFetchErr]   = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  /* Active drill-down state */
  const [l1, setL1] = useState(null);
  const [l2, setL2] = useState(null);

  /* ── Load Categories ── */
  useEffect(() => {
    let cancelled = false;

    const loadCategories = async () => {
      setLoading(true);
      setFetchErr(null);

      try {
        const res = await axios.get(API_URL, {
          params: { tree: true },
          timeout: 8000,
        });

        if (cancelled) return;

        const rawData = res.data?.data ?? res.data ?? [];
        const parsedTree = buildTree(rawData);

        if (parsedTree.length > 0) {
          setTree(parsedTree);
        } else {
          // If API returns empty list, fall back
          setTree(buildTree(CATEGORIES_FALLBACK));
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("[CategoryPicker] API fetch failed, using fallback categories:", err.message);
        
        // Graceful fallback to static categories on network/server error
        setTree(buildTree(CATEGORIES_FALLBACK));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadCategories();
    return () => { cancelled = true; };
  }, [retryCount]);

  /* ── Restore Selection (e.g. Draft Load) ── */
  useEffect(() => {
    if (!value?.id || !tree.length) return;

    for (const rootNode of tree) {
      if (rootNode.id === value.id) {
        setL1(rootNode);
        setL2(null);
        return;
      }
      for (const midNode of rootNode.children ?? []) {
        if (midNode.id === value.id) {
          setL1(rootNode);
          setL2(midNode);
          return;
        }
        for (const leafNode of midNode.children ?? []) {
          if (leafNode.id === value.id) {
            setL1(rootNode);
            setL2(midNode);
            return;
          }
        }
      }
    }
  }, [value?.id, tree]);

  /* ── Handlers ── */
  const handleSelectL1 = useCallback((node) => {
    setL1(node);
    setL2(null);

    if (!node.children?.length) {
      onSelect({
        id: node.id,
        name: node.name,
        slug: node.slug,
        level: node.level ?? 1,
        path: [node.name],
      });
    }
  }, [onSelect]);

  const handleSelectL2 = useCallback((node, parentPath) => {
    setL2(node);

    if (!node.children?.length) {
      onSelect({
        id: node.id,
        name: node.name,
        slug: node.slug,
        level: node.level ?? 2,
        path: buildPath(node, parentPath),
      });
    }
  }, [onSelect]);

  const handleSelectL3 = useCallback((node, parentPath) => {
    onSelect({
      id: node.id,
      name: node.name,
      slug: node.slug,
      level: node.level ?? 3,
      path: buildPath(node, parentPath),
    });
  }, [onSelect]);

  /* ── Render States ── */
  if (loading) {
    return (
      <div className={`cp-wrap${error ? " cp-wrap--error" : ""}`}>
        <Spinner />
      </div>
    );
  }

  if (fetchErr) {
    return (
      <div className={`cp-wrap${error ? " cp-wrap--error" : ""}`}>
        <button
          type="button"
          className="cp-retry"
          onClick={() => setRetryCount((c) => c + 1)}
        >
          {fetchErr}
        </button>
      </div>
    );
  }

  if (!tree.length) {
    return (
      <div className={`cp-wrap${error ? " cp-wrap--error" : ""}`}>
        <p className="cp-empty">No categories available.</p>
      </div>
    );
  }

  const l2Nodes = l1?.children ?? [];
  const l3Nodes = l2?.children ?? [];

  return (
    <div
      className={`cp-wrap${error ? " cp-wrap--error" : ""}`}
      role="group"
      aria-label="Category selector"
    >
      <div className="cp-columns">
        {/* L1: Root categories */}
        <div className="cp-column" role="listbox" aria-label="Main category">
          {tree.map((node) => {
            const isActive   = l1?.id === node.id;
            const isSelected = value?.id === node.id;
            return (
              <button
                key={node.id}
                type="button"
                role="option"
                aria-selected={isActive}
                className={[
                  "cp-item",
                  isActive   ? "cp-item--active"   : "",
                  isSelected ? "cp-item--selected" : "",
                ].join(" ").trim()}
                onClick={() => handleSelectL1(node)}
              >
                {node.icon && (
                  <span className="cp-item-icon" aria-hidden="true">
                    {node.icon}
                  </span>
                )}
                <span className="cp-item-name">{node.name}</span>
                {isSelected && !node.children?.length && (
                  <span className="cp-item-check" aria-label="Selected">
                    <CheckIcon />
                  </span>
                )}
                {node.children?.length > 0 && (
                  <span className="cp-item-arrow" aria-hidden="true">
                    <ChevronRight />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* L2: Sub-categories */}
        {l1 && l2Nodes.length > 0 && (
          <div className="cp-column cp-column--l2" role="listbox" aria-label={`${l1.name} sub-categories`}>
            {l2Nodes.map((node) => {
              const isActive   = l2?.id === node.id;
              const isSelected = value?.id === node.id;
              const parentPath = [l1.name];
              return (
                <button
                  key={node.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={[
                    "cp-item",
                    isActive   ? "cp-item--active"   : "",
                    isSelected ? "cp-item--selected" : "",
                  ].join(" ").trim()}
                  onClick={() => handleSelectL2(node, parentPath)}
                >
                  <span className="cp-item-name">{node.name}</span>
                  {isSelected && !node.children?.length && (
                    <span className="cp-item-check" aria-label="Selected">
                      <CheckIcon />
                    </span>
                  )}
                  {node.children?.length > 0 && (
                    <span className="cp-item-arrow" aria-hidden="true">
                      <ChevronRight />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* L3: Sub-sub-categories */}
        {l2 && l3Nodes.length > 0 && (
          <div className="cp-column cp-column--l3" role="listbox" aria-label={`${l2.name} sub-categories`}>
            {l3Nodes.map((node) => {
              const isSelected = value?.id === node.id;
              const parentPath = [l1.name, l2.name];
              return (
                <button
                  key={node.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={[
                    "cp-item",
                    isSelected ? "cp-item--selected cp-item--active" : "",
                  ].join(" ").trim()}
                  onClick={() => handleSelectL3(node, parentPath)}
                >
                  <span className="cp-item-name">{node.name}</span>
                  {isSelected && (
                    <span className="cp-item-check" aria-label="Selected">
                      <CheckIcon />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Category Summary Bar */}
      {value && (
        <div className="cp-selected-bar" aria-live="polite">
          <CheckIcon />
          <span className="cp-selected-name">{value.name}</span>
          <button
            type="button"
            className="cp-clear-btn"
            aria-label="Clear category selection"
            onClick={() => {
              setL1(null);
              setL2(null);
              onSelect(null);
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
});

export default CategoryPicker;