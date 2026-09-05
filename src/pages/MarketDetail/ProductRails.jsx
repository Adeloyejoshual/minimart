/**
 * src/pages/MarketDetail/ProductRails.jsx
 *
 * 1) You may also like     — 8 items, 2×4 grid
 * 2) More from this seller — 6 items, 2×3 grid
 * 3) Recommended for you   — up to 30, vertical, infinite scroll (10+10+10)
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

const RELATED_LIMIT = 8;
const SELLER_LIMIT = 6;
const REC_TOTAL = 30;
const REC_PAGE = 10;

/* ════════════════════════════════════════════════════════════
   helpers
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
      const { data } = await axios.get(url, { timeout: 10000 });
      const list = normalizeList(data);
      if (list.length) return list;
    } catch {
      /* try next */
    }
  }
  return [];
}

/* ════════════════════════════════════════════════════════════
   GRID CARD (related / seller)
════════════════════════════════════════════════════════════ */
const GridCard = memo(function GridCard({ item, onOpen }) {
  const price = priceOf(item);
  const original = origOf(item);
  const d = discOf(item);
  const img = imgOf(item);

  return (
    <button
      type="button"
      className="mdp-pg-card"
      onClick={() => onOpen(slugOf(item))}
    >
      <div className="mdp-pg-card__media">
        {img ? (
          <img src={img} alt="" loading="lazy" />
        ) : (
          <div className="mdp-pg-card__ph">📦</div>
        )}
        {d > 0 && <span className="mdp-pg-card__badge">-{d}%</span>}
      </div>
      <div className="mdp-pg-card__body">
        <p className="mdp-pg-card__name">{item.name || item.title}</p>
        <p className="mdp-pg-card__price">{formatPrice(price)}</p>
        {original > price && (
          <p className="mdp-pg-card__orig">{formatPrice(original)}</p>
        )}
      </div>
    </button>
  );
});

/* ════════════════════════════════════════════════════════════
   LIST CARD (recommended vertical)
════════════════════════════════════════════════════════════ */
const ListCard = memo(function ListCard({ item, onOpen }) {
  const price = priceOf(item);
  const original = origOf(item);
  const d = discOf(item);
  const img = imgOf(item);

  return (
    <button
      type="button"
      className="mdp-pl-card"
      onClick={() => onOpen(slugOf(item))}
    >
      <div className="mdp-pl-card__media">
        {img ? (
          <img src={img} alt="" loading="lazy" />
        ) : (
          <div className="mdp-pl-card__ph">📦</div>
        )}
        {d > 0 && <span className="mdp-pl-card__badge">-{d}%</span>}
      </div>
      <div className="mdp-pl-card__body">
        <p className="mdp-pl-card__name">{item.name || item.title}</p>
        {item.brand && <p className="mdp-pl-card__brand">{item.brand}</p>}
        <div className="mdp-pl-card__prices">
          <span className="mdp-pl-card__price">{formatPrice(price)}</span>
          {original > price && (
            <span className="mdp-pl-card__orig">{formatPrice(original)}</span>
          )}
        </div>
      </div>
      <span className="mdp-pl-card__chev" aria-hidden="true">
        ›
      </span>
    </button>
  );
});

/* ════════════════════════════════════════════════════════════
   SECTION: 2-col product grid
════════════════════════════════════════════════════════════ */
const ProductGridSection = memo(function ProductGridSection({
  title,
  items,
  loading,
  skeletonCount = 4,
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
        <div className="mdp-pgrid">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className="mdp-pg-skel" />
          ))}
        </div>
      ) : (
        <div className="mdp-pgrid">
          {items.map((item) => (
            <GridCard
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
   SECTION: recommended vertical + infinite scroll
════════════════════════════════════════════════════════════ */
const RecommendedSection = memo(function RecommendedSection({
  title = "Recommended for you",
  allItems, // full pool up to 30
  loading,
}) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(REC_PAGE);
  const sentinelRef = useRef(null);
  const loadingMoreRef = useRef(false);

  // reset when pool changes
  useEffect(() => {
    setVisible(REC_PAGE);
  }, [allItems]);

  const shown = useMemo(
    () => (allItems || []).slice(0, visible),
    [allItems, visible]
  );

  const hasMore = visible < (allItems?.length || 0);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    // tiny delay so scroll feels smooth, still snappy
    requestAnimationFrame(() => {
      setVisible((v) => Math.min(v + REC_PAGE, allItems.length));
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
      { root: null, rootMargin: "200px 0px", threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore, shown.length]);

  if (!loading && (!allItems || allItems.length === 0)) return null;

  return (
    <section className="mdp-psec mdp-psec--rec">
      <div className="mdp-psec__head">
        <h3 className="mdp-psec__title">{title}</h3>
        {!loading && allItems?.length > 0 && (
          <span className="mdp-psec__meta">
            {Math.min(visible, allItems.length)}/{allItems.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="mdp-plist">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mdp-pl-skel" />
          ))}
        </div>
      ) : (
        <>
          <div className="mdp-plist">
            {shown.map((item) => (
              <ListCard
                key={item.id || item.slug}
                item={item}
                onOpen={(s) => s && navigate(`/shop/${s}`)}
              />
            ))}
          </div>

          {/* infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="mdp-rec-sentinel" aria-hidden="true">
              <span className="mdp-rec-loading">Loading more…</span>
            </div>
          )}

          {!hasMore && allItems.length > REC_PAGE && (
            <p className="mdp-rec-end">You’re all caught up</p>
          )}
        </>
      )}
    </section>
  );
});

/* ════════════════════════════════════════════════════════════
   MAIN: fetch + compose
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
  const [recommendedPool, setRecommendedPool] = useState([]);

  const [loadingRel, setLoadingRel] = useState(true);
  const [loadingSeller, setLoadingSeller] = useState(true);
  const [loadingRec, setLoadingRec] = useState(true);

  /* ── 1) Related (8) ── */
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

  /* ── 2) Same seller (6) ── */
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
          `${API_URL}?brand=${encodeURIComponent(product.brand)}&limit=${SELLER_LIMIT + 4}`
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

  /* ── 3) Recommended pool (30), UI shows 10 at a time ── */
  useEffect(() => {
    if (!productId && !slug) return;
    let cancelled = false;

    (async () => {
      setLoadingRec(true);

      // Wait a tick so related/seller can populate for de-dupe (best-effort)
      await new Promise((r) => setTimeout(r, 0));

      let list = excludeIds(
        await getFirstList([
          `${API_URL}/${slug}/recommendations?limit=${REC_TOTAL}`,
          `${SHOP}/${slug}/recommendations?limit=${REC_TOTAL}`,
          `${API_URL}/${productId}/recommended?limit=${REC_TOTAL}`,
          `${SHOP}/recommended?product_id=${productId}&limit=${REC_TOTAL}`,
          `${API_URL}/${slug}/related?limit=${REC_TOTAL}`, // soft fallback
          catSlug
            ? `${API_URL}?category=${encodeURIComponent(catSlug)}&limit=${REC_TOTAL}`
            : null,
        ]),
        [productId]
      );

      if (!cancelled) {
        // de-dupe against related + seller when available
        const taken = new Set(
          [...related, ...sellerItems].map((p) => String(p.id))
        );
        list = list.filter((p) => !taken.has(String(p.id)));
        setRecommendedPool(list.slice(0, REC_TOTAL));
        setLoadingRec(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // intentionally not depending on related/seller to avoid refetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, slug, catSlug]);

  // secondary de-dupe pass when related/seller finish
  useEffect(() => {
    if (!recommendedPool.length) return;
    const taken = new Set(
      [...related, ...sellerItems].map((p) => String(p.id))
    );
    const next = recommendedPool.filter((p) => !taken.has(String(p.id)));
    if (next.length !== recommendedPool.length) {
      setRecommendedPool(next.slice(0, REC_TOTAL));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [related, sellerItems]);

  if (!product) return null;

  return (
    <div className="mdp-rails">
      {/* 1 */}
      <ProductGridSection
        title="You may also like"
        items={related}
        loading={loadingRel}
        skeletonCount={4}
        onSeeAll={
          catSlug
            ? () =>
                navigate(`/catalog?category=${encodeURIComponent(catSlug)}`)
            : undefined
        }
      />

      {/* 2 */}
      <ProductGridSection
        title="More from this seller"
        items={sellerItems}
        loading={loadingSeller}
        skeletonCount={4}
        onSeeAll={
          sellerId
            ? () => navigate(`/seller/${sellerId}`)
            : product?.brand
            ? () =>
                navigate(
                  `/catalog?brand=${encodeURIComponent(product.brand)}`
                )
            : undefined
        }
      />

      {/* 3 */}
      <RecommendedSection
        title="Recommended for you"
        allItems={recommendedPool}
        loading={loadingRec}
      />
    </div>
  );
}

export default memo(ProductRails);