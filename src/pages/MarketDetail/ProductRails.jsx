/**
 * src/pages/MarketDetail/ProductRails.jsx
 *
 * 1) Customers also viewed    — Horizontal swipe rail (Jumia style)
 * 2) More from this seller   — Horizontal swipe rail (Jumia style)
 * 3) Recommended for you     — 2-Column Grid (Temu style) with Infinite Load
 */

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  memo,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  API_URL,
  formatPrice,
  getProductImage,
  calcDiscount,
} from "../../config/marketplace";

const RAW = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const API_ROOT = RAW
  ? RAW.endsWith("/api")
    ? RAW
    : `${RAW}/api`
  : "/api";
const SHOP = `${API_ROOT}/shop`;

const RELATED_LIMIT = 10;
const SELLER_LIMIT = 10;
const REC_TOTAL = 30;
const REC_PAGE = 6;

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function discOf(item) {
  const price = Number(item.price ?? item.sale_price ?? 0);
  const original = Number(item.original_price ?? item.compare_price ?? 0);
  if (!(original > price && price > 0)) return 0;
  try {
    return calcDiscount(price, original);
  } catch {
    return Math.round(((original - price) / original) * 100);
  }
}

function priceOf(item) {
  const n = Number(item.price ?? item.sale_price ?? item.selling_price ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function origOf(item) {
  const n = Number(item.original_price ?? item.compare_price ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function imgOf(item) {
  return getProductImage?.(item) || item.image || item.image_url || item.thumbnail || "";
}

function slugOf(item) {
  return item.slug || item.id;
}

function normalizeList(data) {
  const raw =
    data?.data?.products ||
    data?.data?.items ||
    data?.data ||
    data?.products ||
    data?.items ||
    data ||
    [];
  return Array.isArray(raw) ? raw : [];
}

function excludeIds(list, ids) {
  const ban = new Set((ids || []).map(String));
  return (list || []).filter((p) => p?.id != null && !ban.has(String(p.id)));
}

async function getFirstList(urls) {
  for (const url of urls) {
    if (!url) continue;
    try {
      const { data } = await axios.get(url, { timeout: 8000 });
      const list = normalizeList(data);
      if (list.length) return list;
    } catch {
      /* try next */
    }
  }
  return [];
}

/* ════════════════════════════════════════════════════════════
   1) JUMIA-STYLE HORIZONTAL SWIPE CARD
════════════════════════════════════════════════════════════ */
const HorizontalCard = memo(function HorizontalCard({ item, onOpen }) {
  const price = priceOf(item);
  const original = origOf(item);
  const d = discOf(item);
  const img = imgOf(item);

  return (
    <button
      type="button"
      className="mdp-rail-hcard"
      onClick={() => onOpen(slugOf(item))}
    >
      <div className="mdp-rail-hcard__media">
        {img ? (
          <img src={img} alt="" loading="lazy" />
        ) : (
          <div className="mdp-rail-hcard__ph">📦</div>
        )}
        {d > 0 && <span className="mdp-rail-hcard__badge">-{d}%</span>}
      </div>
      <div className="mdp-rail-hcard__body">
        <p className="mdp-rail-hcard__name">{item.name || item.title}</p>
        <p className="mdp-rail-hcard__price">{formatPrice(price)}</p>
        {original > price && (
          <p className="mdp-rail-hcard__orig">{formatPrice(original)}</p>
        )}
      </div>
    </button>
  );
});

/* ════════════════════════════════════════════════════════════
   2) TEMU-STYLE 2-COLUMN GRID CARD
════════════════════════════════════════════════════════════ */
const TemuGridCard = memo(function TemuGridCard({ item, onOpen }) {
  const price = priceOf(item);
  const original = origOf(item);
  const d = discOf(item);
  const img = imgOf(item);
  const rating = Number(item.rating || item.average_rating || 0);

  return (
    <div className="mdp-temu-card" onClick={() => onOpen(slugOf(item))}>
      <div className="mdp-temu-card__media">
        {img ? (
          <img src={img} alt="" loading="lazy" />
        ) : (
          <div className="mdp-temu-card__ph">📦</div>
        )}
        {d > 0 && <span className="mdp-temu-card__badge">-{d}%</span>}
      </div>

      <div className="mdp-temu-card__body">
        <p className="mdp-temu-card__title">{item.name || item.title}</p>
        
        {rating > 0 && (
          <div className="mdp-temu-card__rating">
            <span className="mdp-temu-card__star">★</span>
            <span className="mdp-temu-card__num">{rating.toFixed(1)}</span>
            {item.reviews_count > 0 && (
              <span className="mdp-temu-card__count">({item.reviews_count})</span>
            )}
          </div>
        )}

        <div className="mdp-temu-card__footer">
          <div className="mdp-temu-card__price-box">
            <span className="mdp-temu-card__price">{formatPrice(price)}</span>
            {original > price && (
              <span className="mdp-temu-card__orig">{formatPrice(original)}</span>
            )}
          </div>

          <button
            type="button"
            className="mdp-temu-card__cart-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(slugOf(item));
            }}
            aria-label="Add to cart"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={16} height={16}>
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   RAIL 1 & 2: HORIZONTAL SWIPE SECTION
════════════════════════════════════════════════════════════ */
const HorizontalSwipeRail = memo(function HorizontalSwipeRail({
  title,
  items,
  loading,
  onSeeAll,
}) {
  const navigate = useNavigate();

  if (!loading && (!items || items.length === 0)) return null;

  return (
    <section className="mdp-psec">
      <div className="mdp-psec__head">
        <h3 className="mdp-psec__title">{title}</h3>
        {onSeeAll && items?.length > 0 && (
          <button type="button" className="mdp-psec__all" onClick={onSeeAll}>
            See all
          </button>
        )}
      </div>

      {loading ? (
        <div className="mdp-rail-hscroll">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="mdp-rail-hskel" />
          ))}
        </div>
      ) : (
        <div className="mdp-rail-hscroll">
          {items.map((item) => (
            <HorizontalCard
              key={item.id || item.slug}
              item={item}
              onOpen={(s) => s && navigate(`/shop/${s}`)}
            />
          ))}
        </div>
      )}
    </section>
  );
});

/* ════════════════════════════════════════════════════════════
   RAIL 3: TEMU-STYLE 2-COLUMN RECOMMENDED GRID
════════════════════════════════════════════════════════════ */
const RecommendedGridSection = memo(function RecommendedGridSection({
  title = "Recommended for you",
  allItems = [],
  loading,
}) {
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(REC_PAGE);
  const sentinelRef = useRef(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    setVisibleCount(REC_PAGE);
  }, [allItems]);

  const visibleItems = useMemo(
    () => (allItems || []).slice(0, visibleCount),
    [allItems, visibleCount]
  );

  const hasMore = visibleCount < (allItems?.length || 0);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    requestAnimationFrame(() => {
      setVisibleCount((v) => Math.min(v + REC_PAGE, allItems.length));
      loadingMoreRef.current = false;
    });
  }, [hasMore, allItems]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: "250px 0px", threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore, visibleItems.length]);

  if (!loading && (!allItems || allItems.length === 0)) return null;

  return (
    <section className="mdp-psec mdp-psec--recommended">
      <div className="mdp-psec__head">
        <h3 className="mdp-psec__title">{title}</h3>
      </div>

      {loading ? (
        <div className="mdp-temu-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="mdp-temu-skel" />
          ))}
        </div>
      ) : (
        <>
          <div className="mdp-temu-grid">
            {visibleItems.map((item) => (
              <TemuGridCard
                key={item.id || item.slug}
                item={item}
                onOpen={(s) => s && navigate(`/shop/${s}`)}
              />
            ))}
          </div>

          {hasMore && (
            <div ref={sentinelRef} className="mdp-rec-sentinel">
              <span className="mdp-rec-loading">Loading more recommendations…</span>
            </div>
          )}
        </>
      )}
    </section>
  );
});

/* ════════════════════════════════════════════════════════════
   MAIN PRODUCT RAILS COMPONENT
════════════════════════════════════════════════════════════ */
function ProductRails({ product }) {
  const navigate = useNavigate();
  const productId = product?.id;
  const slug = product?.slug || productId;

  const sellerId =
    product?.seller_id ||
    product?.seller?.id ||
    product?.user_id ||
    product?.shop_id ||
    null;

  const catSlug =
    typeof product?.category === "string"
      ? product.category
      : product?.category?.slug || product?.category?.name || null;

  const [related, setRelated] = useState([]);
  const [sellerItems, setSellerItems] = useState([]);
  const [recommended, setRecommended] = useState([]);

  const [loadingRel, setLoadingRel] = useState(true);
  const [loadingSeller, setLoadingSeller] = useState(true);
  const [loadingRec, setLoadingRec] = useState(true);

  /* 1) Related (Horizontal) */
  useEffect(() => {
    if (!productId && !slug) return;
    let cancelled = false;

    (async () => {
      setLoadingRel(true);
      const list = excludeIds(
        await getFirstList([
          `${API_URL}/${slug}/related?limit=${RELATED_LIMIT}`,
          `${SHOP}/${slug}/related?limit=${RELATED_LIMIT}`,
          `${API_URL}/${productId}/related?limit=${RELATED_LIMIT}`,
          `${SHOP}/${productId}/related?limit=${RELATED_LIMIT}`,
        ]),
        [productId]
      );
      if (!cancelled) {
        setRelated(list.slice(0, RELATED_LIMIT));
        setLoadingRel(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, slug]);

  /* 2) Same Seller (Horizontal) */
  useEffect(() => {
    if (!productId) return;
    let cancelled = false;

    (async () => {
      setLoadingSeller(true);
      const urls = [];
      if (sellerId) {
        urls.push(
          `${SHOP}/seller/${sellerId}/products?limit=${SELLER_LIMIT}`,
          `${API_ROOT}/sellers/${sellerId}/products?limit=${SELLER_LIMIT}`,
          `${API_URL}?seller_id=${sellerId}&limit=${SELLER_LIMIT}`,
          `${SHOP}?seller_id=${sellerId}&limit=${SELLER_LIMIT}`
        );
      }
      if (product?.brand) {
        urls.push(
          `${API_URL}?brand=${encodeURIComponent(product.brand)}&limit=${SELLER_LIMIT}`
        );
      }

      const list = excludeIds(await getFirstList(urls), [productId]);
      if (!cancelled) {
        setSellerItems(list.slice(0, SELLER_LIMIT));
        setLoadingSeller(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, sellerId, product?.brand]);

  /* 3) Recommended (2-Column Grid) */
  useEffect(() => {
    if (!productId && !slug) return;
    let cancelled = false;

    (async () => {
      setLoadingRec(true);

      let list = excludeIds(
        await getFirstList([
          `${API_URL}/${slug}/recommendations?limit=${REC_TOTAL}`,
          `${SHOP}/${slug}/recommendations?limit=${REC_TOTAL}`,
          `${API_URL}/${productId}/recommended?limit=${REC_TOTAL}`,
          `${SHOP}/recommended?product_id=${productId}&limit=${REC_TOTAL}`,
          catSlug
            ? `${API_URL}?category=${encodeURIComponent(catSlug)}&limit=${REC_TOTAL}`
            : null,
        ]),
        [productId]
      );

      if (!cancelled) {
        const taken = new Set(
          [...related, ...sellerItems].map((p) => String(p.id))
        );
        list = list.filter((p) => !taken.has(String(p.id)));
        setRecommended(list.slice(0, REC_TOTAL));
        setLoadingRec(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, slug, catSlug, related, sellerItems]);

  if (!product) return null;

  return (
    <div className="mdp-rails">
      {/* 1) Customers also viewed (Horizontal Swipe) */}
      <HorizontalSwipeRail
        title="Customers also viewed"
        items={related}
        loading={loadingRel}
        onSeeAll={
          catSlug
            ? () => navigate(`/catalog?category=${encodeURIComponent(catSlug)}`)
            : undefined
        }
      />

      {/* 2) More from this seller (Horizontal Swipe) */}
      <HorizontalSwipeRail
        title="More from this seller"
        items={sellerItems}
        loading={loadingSeller}
        onSeeAll={
          sellerId
            ? () => navigate(`/seller/${sellerId}`)
            : product?.brand
            ? () => navigate(`/catalog?brand=${encodeURIComponent(product.brand)}`)
            : undefined
        }
      />

      {/* 3) Recommended for you (Temu-style 2-Column Grid) */}
      <RecommendedGridSection
        title="Recommended for you"
        allItems={recommended}
        loading={loadingRec}
      />
    </div>
  );
}

export default memo(ProductRails);