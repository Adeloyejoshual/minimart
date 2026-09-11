/**
 * src/pages/MarketDetail/ProductRails.jsx
 * Professional Recommendations & Related Products
 */

import {
  useEffect,
  useState,
  memo,
  useMemo,
  useCallback,
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
const INITIAL_REC_COUNT = 20;
const BATCH_SIZE = 10;

/* ════════════════════════════════════════════════════════════
   CRASH-PROOF HELPERS
════════════════════════════════════════════════════════════ */
function discOf(item) {
  if (!item) return 0;
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
  if (!item) return 0;
  const n = Number(item.price ?? item.sale_price ?? item.selling_price ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function origOf(item) {
  if (!item) return 0;
  const n = Number(item.original_price ?? item.compare_price ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function imgOf(item) {
  if (!item) return "";
  return getProductImage?.(item) || item.image || item.image_url || item.thumbnail || "";
}

function slugOf(item) {
  return item?.slug || item?.id || "";
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
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === "object" && (x.id || x.slug));
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
      /* fallback */
    }
  }
  return [];
}

/* ════════════════════════════════════════════════════════════
   1) HORIZONTAL CARD (Jumia Style)
════════════════════════════════════════════════════════════ */
const HorizontalCard = memo(function HorizontalCard({ item, onOpen }) {
  if (!item) return null;
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
   2) PROFESSIONAL GRID CARD (Temu/Amazon Style)
════════════════════════════════════════════════════════════ */
const ProfessionalCard = memo(function ProfessionalCard({ item, onOpen }) {
  if (!item) return null;
  const price = priceOf(item);
  const original = origOf(item);
  const d = discOf(item);
  const img = imgOf(item);
  const rating = Number(item.rating || item.average_rating || 0);

  return (
    <div className="pr-card" onClick={() => onOpen(slugOf(item))}>
      <div className="pr-card__img-wrap">
        {img ? (
          <img src={img} alt="" loading="lazy" className="pr-card__img" />
        ) : (
          <div className="pr-card__ph">📦</div>
        )}
        {d > 0 && <span className="pr-card__badge">-{d}% OFF</span>}
      </div>

      <div className="pr-card__body">
        <p className="pr-card__name">{item.name || item.title}</p>
        
        {rating > 0 && (
          <div className="pr-card__rating">
            <span className="pr-card__star" aria-hidden="true">★</span>
            <span className="pr-card__num">{rating.toFixed(1)}</span>
            {item.reviews_count > 0 && (
              <span className="pr-card__count">· {item.reviews_count}</span>
            )}
          </div>
        )}

        <div className="pr-card__prices">
          <span className="pr-card__price">{formatPrice(price)}</span>
          {original > price && (
            <span className="pr-card__orig">{formatPrice(original)}</span>
          )}
        </div>
      </div>
      
      <button
        type="button"
        className="pr-card__add-btn"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(slugOf(item));
        }}
        aria-label="View product"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={16} height={16}>
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
      </button>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   HORIZONTAL SWIPE SECTION
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
            See all →
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
          {items.map((item, idx) => (
            <HorizontalCard
              key={item.id || item.slug || idx}
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
   RECOMMENDED SECTION (GRID)
════════════════════════════════════════════════════════════ */
const RecommendedGridSection = memo(function RecommendedGridSection({
  title = "Recommended for you",
  allItems = [],
  loading,
}) {
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(INITIAL_REC_COUNT);

  useEffect(() => {
    setVisibleCount(INITIAL_REC_COUNT);
  }, [allItems]);

  const visibleItems = useMemo(
    () => (allItems || []).slice(0, visibleCount),
    [allItems, visibleCount]
  );

  const hasMore = visibleCount < (allItems?.length || 0);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, allItems.length));
  }, [allItems]);

  if (!loading && (!allItems || allItems.length === 0)) return null;

  return (
    <section className="mdp-psec mdp-psec--recommended">
      <div className="mdp-psec__head">
        <h3 className="mdp-psec__title">{title}</h3>
        {!loading && allItems?.length > 0 && (
          <span className="mdp-psec__meta">
            Showing {visibleItems.length} of {allItems.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="pr-grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="pr-skel" />
          ))}
        </div>
      ) : (
        <>
          <div className="pr-grid">
            {visibleItems.map((item, idx) => (
              <ProfessionalCard
                key={item.id || item.slug || idx}
                item={item}
                onOpen={(s) => s && navigate(`/shop/${s}`)}
              />
            ))}
          </div>

          {hasMore && (
            <div className="pr-load-more-wrap">
              <button
                type="button"
                className="pr-load-more-btn"
                onClick={handleLoadMore}
              >
                Load More Products
              </button>
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

  /* 1) Related Products */
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

  /* 2) Same Seller Products */
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

  /* 3) Recommended Products */
  useEffect(() => {
    if (!productId && !slug) return;
    let cancelled = false;

    (async () => {
      setLoadingRec(true);

      const urls = [
        `${API_URL}/${slug}/recommendations?limit=40`,
        `${SHOP}/${slug}/recommendations?limit=40`,
        `${API_URL}/${productId}/recommended?limit=40`,
        `${SHOP}/recommended?product_id=${productId}&limit=40`,
        catSlug ? `${API_URL}?category=${encodeURIComponent(catSlug)}&limit=40` : null,
        `${API_URL}?limit=40`,
        `${SHOP}?limit=40`,
      ];

      let list = excludeIds(await getFirstList(urls), [productId]);

      if (!cancelled) {
        setRecommended(list.slice(0, 40));
        setLoadingRec(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, slug, catSlug]);

  if (!product) return null;

  return (
    <div className="mdp-rails">
      {/* 1) Customers also viewed */}
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

      {/* 2) More from this seller */}
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

      {/* 3) Recommended for you */}
      <RecommendedGridSection
        title="Recommended for you"
        allItems={recommended}
        loading={loadingRec}
      />
    </div>
  );
}

export default memo(ProductRails);