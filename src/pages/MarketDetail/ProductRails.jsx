/**
 * src/pages/MarketDetail/ProductRails.jsx
 * Related (H) · Same seller (H) · Recommended (V)
 */

import { useEffect, useState, memo, useMemo } from "react";
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
  return Number.isFinite(n) ? n : 0;
}

function origOf(item) {
  const n = Number(item.original_price ?? item.compare_price ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function imgOf(item) {
  return getProductImage(item) || item.image || item.image_url || item.thumbnail;
}

function slugOf(item) {
  return item.slug || item.id;
}

/* ── Card (horizontal rail) ── */
const HCard = memo(function HCard({ item, onOpen }) {
  const price = priceOf(item);
  const original = origOf(item);
  const d = discOf(item);
  const img = imgOf(item);

  return (
    <button type="button" className="mdp-rail-hcard" onClick={() => onOpen(slugOf(item))}>
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
        {original > price && price > 0 && (
          <p className="mdp-rail-hcard__orig">{formatPrice(original)}</p>
        )}
      </div>
    </button>
  );
});

/* ── Card (vertical list) ── */
const VCard = memo(function VCard({ item, onOpen }) {
  const price = priceOf(item);
  const original = origOf(item);
  const d = discOf(item);
  const img = imgOf(item);

  return (
    <button type="button" className="mdp-rail-vcard" onClick={() => onOpen(slugOf(item))}>
      <div className="mdp-rail-vcard__media">
        {img ? (
          <img src={img} alt="" loading="lazy" />
        ) : (
          <div className="mdp-rail-vcard__ph">📦</div>
        )}
        {d > 0 && <span className="mdp-rail-vcard__badge">-{d}%</span>}
      </div>
      <div className="mdp-rail-vcard__body">
        <p className="mdp-rail-vcard__name">{item.name || item.title}</p>
        {item.brand && <p className="mdp-rail-vcard__brand">{item.brand}</p>}
        <div className="mdp-rail-vcard__prices">
          <span className="mdp-rail-vcard__price">{formatPrice(price)}</span>
          {original > price && price > 0 && (
            <span className="mdp-rail-vcard__orig">{formatPrice(original)}</span>
          )}
        </div>
      </div>
      <span className="mdp-rail-vcard__chev" aria-hidden="true">
        ›
      </span>
    </button>
  );
});

function SkeletonH() {
  return (
    <div className="mdp-rail-hscroll">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="mdp-rail-hskel" />
      ))}
    </div>
  );
}

function SkeletonV() {
  return (
    <div className="mdp-rail-vlist">
      {[0, 1, 2].map((i) => (
        <div key={i} className="mdp-rail-vskel" />
      ))}
    </div>
  );
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

async function getFirstList(urls) {
  for (const url of urls) {
    if (!url) continue;
    try {
      const { data } = await axios.get(url, { timeout: 10000 });
      const list = normalizeList(data);
      if (list.length) return list;
    } catch {
      /* next */
    }
  }
  return [];
}

function excludeSelf(list, productId) {
  return (list || []).filter((p) => String(p.id) !== String(productId));
}

/* ═══════════════ Horizontal rail ═══════════════ */
export const HorizontalRail = memo(function HorizontalRail({
  title,
  items,
  loading,
  onSeeAll,
  emptyHide = true,
}) {
  const navigate = useNavigate();
  if (!loading && emptyHide && (!items || !items.length)) return null;

  return (
    <section className="mdp-rail mdp-rail--h">
      <div className="mdp-rail__head">
        <h3 className="mdp-rail__title">{title}</h3>
        {onSeeAll && items?.length > 0 && (
          <button type="button" className="mdp-rail__all" onClick={onSeeAll}>
            See all
          </button>
        )}
      </div>
      {loading ? (
        <SkeletonH />
      ) : (
        <div className="mdp-rail-hscroll">
          {items.map((item) => (
            <HCard
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

/* ═══════════════ Vertical recommended ═══════════════ */
export const VerticalRecommended = memo(function VerticalRecommended({
  title = "Recommended",
  items,
  loading,
  maxHeight = 420,
}) {
  const navigate = useNavigate();
  if (!loading && (!items || !items.length)) return null;

  return (
    <section className="mdp-rail mdp-rail--v">
      <div className="mdp-rail__head">
        <h3 className="mdp-rail__title">{title}</h3>
      </div>
      {loading ? (
        <SkeletonV />
      ) : (
        <div className="mdp-rail-vscroll" style={{ maxHeight }}>
          <div className="mdp-rail-vlist">
            {items.map((item) => (
              <VCard
                key={item.id || item.slug}
                item={item}
                onOpen={(s) => s && navigate(`/shop/${s}`)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
});

/* ═══════════════ Fetch + compose all three ═══════════════ */
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
  const sellerName =
    product?.seller?.name ||
    product?.seller_name ||
    product?.shop_name ||
    "this seller";

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

  useEffect(() => {
    if (!productId && !slug) return;
    let cancelled = false;

    (async () => {
      setLoadingRel(true);
      const list = excludeSelf(
        await getFirstList([
          `${API_URL}/${slug}/related`,
          `${SHOP}/${slug}/related`,
          `${API_URL}/${productId}/related`,
          `${SHOP}/products/${productId}/related`,
        ]),
        productId
      );
      if (!cancelled) {
        setRelated(list.slice(0, 12));
        setLoadingRel(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, slug]);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;

    (async () => {
      setLoadingSeller(true);
      const urls = [];
      if (sellerId) {
        urls.push(
          `${SHOP}/seller/${sellerId}/products`,
          `${API_ROOT}/sellers/${sellerId}/products`,
          `${API_URL}?seller_id=${sellerId}&limit=12`,
          `${SHOP}?seller_id=${sellerId}&limit=12`
        );
      }
      // fallback: same brand as soft “seller-like” feed
      if (product?.brand) {
        urls.push(`${API_URL}?brand=${encodeURIComponent(product.brand)}&limit=12`);
      }

      let list = excludeSelf(await getFirstList(urls), productId);
      if (!cancelled) {
        setSellerItems(list.slice(0, 12));
        setLoadingSeller(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, sellerId, product?.brand]);

  useEffect(() => {
    if (!productId && !slug) return;
    let cancelled = false;

    (async () => {
      setLoadingRec(true);
      let list = excludeSelf(
        await getFirstList([
          `${API_URL}/${slug}/recommendations`,
          `${SHOP}/${slug}/recommendations`,
          `${API_URL}/${productId}/recommended`,
          `${SHOP}/recommended?product_id=${productId}`,
          // last resort: category catalog
          catSlug
            ? `${API_URL}?category=${encodeURIComponent(catSlug)}&limit=20`
            : null,
        ]),
        productId
      );

      // de-dupe vs related/seller for a fresher vertical feed
      if (!cancelled) {
        const taken = new Set(
          [...related, ...sellerItems].map((p) => String(p.id))
        );
        list = list.filter((p) => !taken.has(String(p.id)));
        setRecommended(list.slice(0, 20));
        setLoadingRec(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, slug, catSlug]);

  const sellerTitle = useMemo(
    () => `More from ${sellerName}`,
    [sellerName]
  );

  if (!product) return null;

  return (
    <div className="mdp-rails">
      {/* 1) Related — horizontal */}
      <HorizontalRail
        title="Related products"
        items={related}
        loading={loadingRel}
        onSeeAll={
          catSlug
            ? () =>
                navigate(`/catalog?category=${encodeURIComponent(catSlug)}`)
            : undefined
        }
      />

      {/* 2) Same seller — horizontal */}
      <HorizontalRail
        title={sellerTitle}
        items={sellerItems}
        loading={loadingSeller}
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

      {/* 3) Recommended — vertical scrollable */}
      <VerticalRecommended
        title="Recommended for you"
        items={recommended}
        loading={loadingRec}
        maxHeight={440}
      />
    </div>
  );
}

export default memo(ProductRails);