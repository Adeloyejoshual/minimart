// src/components/TopNav.jsx
import React, {
  useState, useEffect, useMemo,
  useCallback, useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";
import HamburgerMenu from "./HamburgerMenu";
import "../styles/TopNav.css";

const API = import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";
const PH  = "https://placehold.co/88x88/eae6e0/a8a39d?text=?";

/* ─────────────────────────────────────────────
   SEARCH SCORING
   Uses trigram overlap — far better than
   character-by-character comparison.
───────────────────────────────────────────── */
const norm = (s = "") => s.toLowerCase().trim();

const trigrams = (s) => {
  const t = new Set();
  const n = norm(s);
  for (let i = 0; i < n.length - 2; i++) t.add(n.slice(i, i + 3));
  return t;
};

const trigramScore = (query, target) => {
  if (!query || !target) return 0;
  const q = trigrams(query);
  const t = trigrams(target);
  if (!q.size || !t.size) return 0;

  let matches = 0;
  q.forEach((g) => { if (t.has(g)) matches++; });
  return matches / Math.max(q.size, t.size);
};

const scoreProduct = (query, product) => {
  const q = norm(query);
  const title = norm(product.title || "");

  // Exact prefix match → top priority
  if (title.startsWith(q)) return 1 + trigramScore(q, title);

  // Word boundary match
  if (title.split(" ").some((w) => w.startsWith(q))) return 0.8 + trigramScore(q, title);

  // Contains match
  if (title.includes(q)) return 0.6 + trigramScore(q, title);

  // Trigram fallback
  const ts = trigramScore(q, title);
  return ts > 0.2 ? ts : 0;
};

/* ─────────────────────────────────────────────
   IMAGE EXTRACTOR
───────────────────────────────────────────── */
const getImg = (p) => {
  const f = Array.isArray(p?.images) ? p.images[0] : null;
  if (!f) return PH;
  return typeof f === "string" ? f : f.url || f.thumbnail_url || PH;
};

const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

/* ─────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────── */
export default function TopNav() {
  const navigate           = useNavigate();
  const { products }       = useProductCache();

  const [query,     setQuery]     = useState("");
  const [debounced, setDebounced] = useState("");
  const [apiHits,   setApiHits]   = useState([]);
  const [open,      setOpen]      = useState(false);
  const [fetching,  setFetching]  = useState(false);

  /* ── HAMBURGER STATE ── */
  const [menuOpen, setMenuOpen] = useState(false);

  const inputRef = useRef(null);

  /* ── DEBOUNCE ─────────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  /* ── INSTANT RESULTS from cache ──────────── */
  const cacheResults = useMemo(() => {
    if (!debounced || debounced.length < 2) return [];

    return products
      .map((p) => ({ ...p, _score: scoreProduct(debounced, p) }))
      .filter((p) => p._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 6);
  }, [debounced, products]);

  /* ── NETWORK SEARCH (when cache has < 3 hits) */
  useEffect(() => {
    if (!debounced || debounced.length < 2) {
      setApiHits([]);
      return;
    }
    if (cacheResults.length >= 3) {
      setApiHits([]);
      return;
    }

    let cancelled = false;
    setFetching(true);

    fetch(`${API}/search?q=${encodeURIComponent(debounced)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (!cancelled) {
          const hits = Array.isArray(data) ? data : (data.products || []);
          setApiHits(hits.slice(0, 6));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFetching(false); });

    return () => { cancelled = true; };
  }, [debounced, cacheResults.length]);

  /* ── MERGED RESULTS ───────────────────────── */
  const results = useMemo(() => {
    const seen = new Set(cacheResults.map((p) => p.id));
    const extra = apiHits.filter((p) => !seen.has(p.id));
    return [...cacheResults, ...extra].slice(0, 6);
  }, [cacheResults, apiHits]);

  /* ── ACTIONS ──────────────────────────────── */
  const goSearch = useCallback((text) => {
    const q = (text || query).trim();
    if (!q) return;
    setQuery("");
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }, [query, navigate]);

  const goProduct = useCallback((p) => {
    setOpen(false);
    setQuery("");
    navigate(`/product/${p.slug || p.id}`);
  }, [navigate]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const showDropdown = open && debounced.length >= 2;

  /* ── RENDER ───────────────────────────────── */
  return (
    <>
      <div className="tn-wrap">

        {/* ── BRAND ROW ── */}
        <div className="tn-header">
          {/* Hamburger button — left side */}
          <button
            className="tn-hamburger"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
          >
            <span className="tn-ham-line" />
            <span className="tn-ham-line tn-ham-line--mid" />
            <span className="tn-ham-line" />
          </button>

          <div className="tn-brand" onClick={() => navigate("/")}>
            🛒 Mini<span>Mart</span>
          </div>
        </div>

        {/* ── SEARCH ROW ── */}
        <div className="tn-search-row">
          <div className="tn-search-box">
            <input
              ref={inputRef}
              className="tn-input"
              value={query}
              placeholder="Search products, categories…"
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") goSearch();
                if (e.key === "Escape") close();
              }}
              autoComplete="off"
              spellCheck="false"
            />
            <button
              className="tn-search-btn"
              onClick={() => goSearch()}
              aria-label="Search"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>

          {/* ── DROPDOWN ── */}
          {showDropdown && (
            <>
              <div className="tn-overlay" onClick={close} />

              <div className="tn-dropdown">
                <div className="tn-drop-header">
                  <span className="tn-drop-count">
                    {fetching
                      ? "Searching…"
                      : results.length
                        ? `${results.length} result${results.length !== 1 ? "s" : ""}`
                        : "No results"
                    }
                  </span>
                  <button className="tn-drop-close" onClick={close}>✕ Close</button>
                </div>

                {results.length > 0 ? (
                  <>
                    {results.map((p, i) => (
                      <div
                        key={p.id}
                        className="tn-result"
                        onClick={() => goProduct(p)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && goProduct(p)}
                      >
                        <img
                          className="tn-result-img"
                          src={getImg(p)}
                          alt={p.title}
                          loading="lazy"
                        />
                        <div className="tn-result-body">
                          <div className="tn-result-title">{p.title}</div>
                          <div className="tn-result-meta">
                            <span className="tn-result-price">{naira(p.price)}</span>
                            {(p.location?.city || p.location_city) && (
                              <span className="tn-result-loc">
                                · 📍 {p.location?.city || p.location_city}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="tn-result-rank">#{i + 1}</span>
                      </div>
                    ))}

                    <div className="tn-see-all-row">
                      <button
                        className="tn-see-all-btn"
                        onClick={() => goSearch(debounced)}
                      >
                        See all results for "{debounced}" →
                      </button>
                    </div>
                  </>
                ) : !fetching ? (
                  <div className="tn-no-results">
                    <div className="tn-no-results-emoji">🔍</div>
                    <div className="tn-no-results-text">
                      No products found for "{debounced}"
                    </div>
                    <button
                      className="tn-no-results-btn"
                      onClick={() => goSearch(debounced)}
                    >
                      Search anyway →
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

      </div>

      {/* ── HAMBURGER MENU (rendered outside tn-wrap so it overlays everything) ── */}
      <HamburgerMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}
