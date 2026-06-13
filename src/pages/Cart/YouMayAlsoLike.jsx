// pages/Cart/YouMayAlsoLike.jsx

import React, {
  useState, useEffect, memo, useCallback, useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = "https://minimart-ivrm.onrender.com/api";

const fmt = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

// ── Waterfall endpoints — tries each until one returns data ─
const ENDPOINTS = [
  (exclude) => ({
    url:    `${API_BASE}/products/suggestions`,
    params: { exclude, limit: 16 },
  }),
  () => ({
    url:    `${API_BASE}/products/trending`,
    params: { limit: 16 },
  }),
  () => ({
    url:    `${API_BASE}/products`,
    params: { limit: 16, sort: "newest", status: "active" },
  }),
];

function extractProducts(data) {
  return (
    data?.data?.products ??
    data?.data?.items    ??
    data?.data           ??
    data?.products       ??
    data?.items          ??
    (Array.isArray(data) ? data : [])
  );
}

// ═══════════════════════════════════════════════════════════
// SINGLE SUGGESTION CARD
// ═══════════════════════════════════════════════════════════
const SuggCard = memo(function SuggCard({ product, onAddToCart }) {
  const navigate = useNavigate();
  const [imgErr, setImgErr] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added,  setAdded]  = useState(false);
  const addTimer = useRef(null);

  useEffect(() => () => clearTimeout(addTimer.current), []);

  const image = !imgErr
    ? (Array.isArray(product.images)
        ? (product.images[0] ?? null)
        : (product.image ?? null))
    : null;

  const hasDiscount =
    Number(product.compare_price ?? product.comparePrice ?? 0) >
    Number(product.price ?? 0);

  const comparePrice = Number(
    product.compare_price ?? product.comparePrice ?? 0
  );

  const discountPct = hasDiscount
    ? Math.round(
        ((comparePrice - Number(product.price)) / comparePrice) * 100
      )
    : 0;

  const handleAdd = useCallback(async (e) => {
    e.stopPropagation();
    if (adding || added) return;
    setAdding(true);
    try {
      await onAddToCart(product);
      setAdded(true);
      addTimer.current = setTimeout(() => setAdded(false), 2200);
    } catch {
      // parent handles error
    } finally {
      setAdding(false);
    }
  }, [product, onAddToCart, adding, added]);

  const handleNav = useCallback(() => {
    navigate(`/product/${product.slug ?? product.id}`);
  }, [navigate, product.slug, product.id]);

  const name = product.name ?? product.title ?? "Product";

  return (
    <article
      className="sugg-card"
      onClick={handleNav}
      onKeyDown={(e) => e.key === "Enter" && handleNav()}
      role="button"
      tabIndex={0}
      aria-label={`View ${name}`}
    >
      {/* ── Image ── */}
      <div className="sugg-card__img-wrap">
        {image ? (
          <img
            src={image}
            alt={name}
            className="sugg-card__img"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="sugg-card__img-placeholder" aria-hidden="true">
            📦
          </div>
        )}
        {hasDiscount && (
          <span className="sugg-card__badge sugg-card__badge--sale">
            -{discountPct}%
          </span>
        )}
        {product.isNew && !hasDiscount && (
          <span className="sugg-card__badge sugg-card__badge--new">New</span>
        )}
      </div>

      {/* ── Info ── */}
      <div className="sugg-card__info">
        <p className="sugg-card__name" title={name}>{name}</p>

        {Number(product.rating ?? 0) > 0 && (
          <div
            className="sugg-card__rating"
            aria-label={`${product.rating} out of 5 stars`}
          >
            <span className="sugg-card__stars" aria-hidden="true">
              {"★".repeat(Math.round(product.rating))}
              {"☆".repeat(5 - Math.round(product.rating))}
            </span>
            <span className="sugg-card__review-count">
              ({product.reviewCount ?? product.review_count ?? 0})
            </span>
          </div>
        )}

        <div className="sugg-card__price-row">
          <span className="sugg-card__price">{fmt(product.price)}</span>
          {hasDiscount && (
            <span className="sugg-card__compare">{fmt(comparePrice)}</span>
          )}
        </div>
      </div>

      {/* ── Add button ── */}
      <button
        className={[
          "sugg-card__add-btn",
          added  ? "sugg-card__add-btn--added"   : "",
          adding ? "sugg-card__add-btn--loading" : "",
        ].filter(Boolean).join(" ")}
        onClick={handleAdd}
        disabled={adding}
        aria-label={added ? `${name} added` : `Add ${name} to cart`}
      >
        {adding ? (
          <span className="sugg-spinner" aria-hidden="true" />
        ) : added ? (
          "✓ Added!"
        ) : (
          "Add to Cart"
        )}
      </button>
    </article>
  );
});

// ── Skeleton ─────────────────────────────────────────────────
function SuggSkeleton({ count = 5 }) {
  return (
    <div className="sugg-scroll">
      <div className="sugg-track">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="sugg-skeleton" aria-hidden="true">
            <div className="sugg-skeleton__img  sugg-shimmer" />
            <div className="sugg-skeleton__line sugg-shimmer" />
            <div className="sugg-skeleton__line sugg-skeleton__line--sm sugg-shimmer" />
            <div className="sugg-skeleton__btn  sugg-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// YOU MAY ALSO LIKE SECTION
// ═══════════════════════════════════════════════════════════
const YouMayAlsoLike = memo(function YouMayAlsoLike({
  cartItems   = [],
  onAddToCart,
}) {
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [page,     setPage]     = useState(0);   // for load more
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Only fetch once — products don't change while user is in cart
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(false);

      const excludeIds = cartItems
        .map((i) => i.productId ?? i.id)
        .filter(Boolean)
        .slice(0, 10)
        .join(",");

      for (const buildEndpoint of ENDPOINTS) {
        if (cancelled) return;

        const { url, params } = buildEndpoint(excludeIds);

        try {
          const { data } = await axios.get(url, {
            params,
            timeout: 9000,
          });

          const found = extractProducts(data);

          if (!cancelled && found.length > 0) {
            setProducts(found);
            setLoading(false);
            return; // success
          }
        } catch (err) {
          if (process.env.NODE_ENV === "development") {
            console.warn(`[YouMayAlsoLike] ${url} failed:`, err.message);
          }
          // try next endpoint
        }
      }

      // all endpoints failed
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Paginate locally — show 8 at a time
  const PAGE_SIZE = 8;
  const visible   = products.slice(0, PAGE_SIZE * (page + 1));
  const hasMore   = visible.length < products.length;

  if (!loading && (error || products.length === 0)) return null;

  return (
    <section
      className="ct-section-block"
      aria-label="You may also like"
    >
      {/* ── Header ── */}
      <div className="ct-section-header">
        <div className="ct-section-header__left">
          <h3 className="ct-section-title">
            <span aria-hidden="true">✨</span> You May Also Like
          </h3>
          <p className="ct-section-sub">Hand-picked for you</p>
        </div>
        <a
          href="/minimart"
          className="ct-section-see-all"
          aria-label="Browse all products"
        >
          See all →
        </a>
      </div>

      {/* ── Cards or skeleton ── */}
      {loading ? (
        <SuggSkeleton count={5} />
      ) : (
        <>
          <div className="sugg-scroll" role="list">
            <div className="sugg-track">
              {visible.map((product) => (
                <div key={product.id} role="listitem">
                  <SuggCard
                    product={product}
                    onAddToCart={onAddToCart}
                  />
                </div>
              ))}
            </div>
          </div>

          {hasMore && (
            <div className="sugg-load-more-wrap">
              <button
                className="sugg-load-more-btn"
                onClick={() => setPage((p) => p + 1)}
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
});

export default YouMayAlsoLike;