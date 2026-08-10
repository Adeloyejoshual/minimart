/**
 * src/pages/PostAds/CategoryPicker.jsx
 *
 * Hierarchical category drill-down picker.
 *
 * Fetches: GET /api/categories  (returns tree with children[])
 * Renders: L1 column → L2 column → L3 column (Jumia-style)
 *
 * Props:
 *   value     { id, name, slug, level, path[] } | null
 *   onSelect  (node) => void  — called when a leaf (or any node) is confirmed
 *   error     boolean         — shows error ring if true
 *
 * Node shape returned to onSelect:
 * {
 *   id    : "uuid",
 *   name  : "Smartphones",
 *   slug  : "smartphones",
 *   level : 2,
 *   path  : ["Electronics", "Phones & Tablets", "Smartphones"],
 * }
 */

import { useEffect, useState, useCallback, memo } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL;

/* ── Chevron icon ── */
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

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

/**
 * Build the ancestor path array for a node by walking up the tree.
 * e.g. ["Electronics", "Phones & Tablets", "Smartphones"]
 */
function buildPath(node, parentPath = []) {
  return [...parentPath, node.name];
}

/* ══════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════ */
const CategoryPicker = memo(function CategoryPicker({ value, onSelect, error }) {

  /* ── State ── */
  const [tree,     setTree]     = useState([]);   // L1 root nodes
  const [loading,  setLoading]  = useState(true);
  const [fetchErr, setFetchErr] = useState(null);

  /* Active drill path — each entry is a node from the tree */
  const [l1, setL1] = useState(null);   // selected L1 node
  const [l2, setL2] = useState(null);   // selected L2 node

  /* ── Fetch tree on mount ── */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setFetchErr(null);

        const { data } = await axios.get(`${API}/api/categories`, {
          params : { tree: true },   // backend returns nested children[]
          timeout: 8000,
        });

        if (cancelled) return;

        /*
         * Expected response shape:
         * { success: true, data: [ { id, name, slug, level, children: [...] } ] }
         * OR just an array: [ { id, name, slug, level, children: [...] } ]
         */
        const nodes = Array.isArray(data) ? data : (data?.data ?? []);
        setTree(nodes);

      } catch (err) {
        if (cancelled) return;
        console.error("[CategoryPicker] fetch error:", err.message);
        setFetchErr("Could not load categories. Tap to retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  /* ── Restore drill state from existing value (e.g. draft restore) ── */
  useEffect(() => {
    if (!value?.id || !tree.length) return;

    /*
     * Walk the tree to find which L1/L2 parents contain the saved node.
     * This restores the column highlight when draft is loaded.
     */
    for (const rootNode of tree) {
      if (rootNode.id === value.id) {
        setL1(rootNode);
        setL2(null);
        return;
      }
      for (const midNode of (rootNode.children ?? [])) {
        if (midNode.id === value.id) {
          setL1(rootNode);
          setL2(midNode);
          return;
        }
        for (const leafNode of (midNode.children ?? [])) {
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

    /* If L1 has no children, treat it as a leaf and select immediately */
    if (!node.children?.length) {
      onSelect({
        id   : node.id,
        name : node.name,
        slug : node.slug,
        level: node.level,
        path : [node.name],
      });
    }
  }, [onSelect]);

  const handleSelectL2 = useCallback((node, parentPath) => {
    setL2(node);

    /* If L2 has no children, treat it as a leaf */
    if (!node.children?.length) {
      onSelect({
        id   : node.id,
        name : node.name,
        slug : node.slug,
        level: node.level,
        path : buildPath(node, parentPath),
      });
    }
  }, [onSelect]);

  const handleSelectL3 = useCallback((node, parentPath) => {
    onSelect({
      id   : node.id,
      name : node.name,
      slug : node.slug,
      level: node.level,
      path : buildPath(node, parentPath),
    });
  }, [onSelect]);

  /* ── Render: loading ── */
  if (loading) {
    return (
      <div className={`cp-wrap${error ? " cp-wrap--error" : ""}`}>
        <Spinner />
      </div>
    );
  }

  /* ── Render: error ── */
  if (fetchErr) {
    return (
      <div className={`cp-wrap${error ? " cp-wrap--error" : ""}`}>
        <button
          type="button"
          className="cp-retry"
          onClick={() => {
            setFetchErr(null);
            setLoading(true);
            /* Re-trigger useEffect by toggling a dummy key — simplest approach
               is to just reload. For now, reload page. In prod, extract
               load() to a ref and call it here. */
            window.location.reload();
          }}
        >
          {fetchErr}
        </button>
      </div>
    );
  }

  /* ── Render: empty ── */
  if (!tree.length) {
    return (
      <div className={`cp-wrap${error ? " cp-wrap--error" : ""}`}>
        <p className="cp-empty">No categories available yet.</p>
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
      {/* ── L1: Root categories ── */}
      <div className="cp-columns">

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

        {/* ── L2: Sub-categories (shown when L1 is selected and has children) ── */}
        {l1 && l2Nodes.length > 0 && (
          <div className="cp-column cp-column--l2"
            role="listbox"
            aria-label={`${l1.name} sub-categories`}
          >
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

        {/* ── L3: Leaf categories ── */}
        {l2 && l3Nodes.length > 0 && (
          <div className="cp-column cp-column--l3"
            role="listbox"
            aria-label={`${l2.name} sub-categories`}
          >
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

      {/* ── Selected category summary ── */}
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