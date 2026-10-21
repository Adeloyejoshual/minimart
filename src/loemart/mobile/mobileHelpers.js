/**
 * src/loemart/mobile/mobileHelpers.js
 * Mobile helper utilities, API routes, image resolvers, and recently viewed auto-pruning.
 */

export const API =
  import.meta.env.VITE_API_URL || "https://loemart.com/api";

export const RECENT_KEY = "lm-recently-viewed";
const LEGACY_KEYS = ["lm_recently_viewed", "recently_viewed", "loemart_recently_viewed"];

/* ════════════════════════════════════════════════════════════
   IMAGE RESOLVER
════════════════════════════════════════════════════════════ */
export function primaryImg(images, product) {
  if (Array.isArray(images) && images.length > 0) {
    const primary = images.find((i) => i?.is_primary) || images[0];
    if (primary?.url) return primary.url;
    if (typeof primary === "string") return primary;
  }
  if (product?.image) return product.image;
  if (product?.primary_image) return product.primary_image;
  if (product?.cover_image) return product.cover_image;
  return "/placeholder.png";
}

/* ════════════════════════════════════════════════════════════
   PRODUCT AVAILABILITY & STOCK CHECK
════════════════════════════════════════════════════════════ */
/**
 * Strict evaluator for catalog items:
 * Returns false if the product is soft-deleted, inactive, hidden, paused, OR out of stock.
 */
export function isProductAvailable(product) {
  if (!product) return false;

  // 1. Soft-deleted / Inactive / Hidden / Paused checks
  if (
    product.deleted_at ||
    product.status === "deleted" ||
    product.is_active === false ||
    product.is_hidden === true ||
    product.is_paused === true
  ) {
    return false;
  }

  if (product.status && !["active", "approved"].includes(product.status)) {
    return false;
  }

  // 2. Out of Stock checks
  if (
    product.is_out_of_stock === true ||
    product.out_of_stock === true ||
    product.stock_status === "out_of_stock" ||
    product.status === "out_of_stock"
  ) {
    return false;
  }

  // Check variants if present
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const totalVariantStock = product.variants.reduce((sum, v) => {
      const q = Number(v?.stock ?? v?.quantity ?? 0);
      return sum + (Number.isFinite(q) && q > 0 ? q : 0);
    }, 0);
    if (totalVariantStock <= 0) return false;
    return true;
  }

  // Base stock check
  const rawStock = product.stock ?? product.quantity;
  if (rawStock !== null && rawStock !== undefined) {
    const parsed = Number(rawStock);
    if (Number.isFinite(parsed) && parsed <= 0) {
      return false;
    }
  }

  return true;
}

/* ════════════════════════════════════════════════════════════
   RECENTLY VIEWED (BASED ON YOUR VIEWS) HELPERS
════════════════════════════════════════════════════════════ */

/**
 * Get recently viewed products cached in localStorage.
 * Automatically migrates legacy keys and filters out deleted or out-of-stock items.
 */
export const getRecentlyViewed = () => {
  try {
    let raw = localStorage.getItem(RECENT_KEY);

    // Legacy key migration
    if (!raw) {
      for (const k of LEGACY_KEYS) {
        const legacyVal = localStorage.getItem(k);
        if (legacyVal) {
          raw = legacyVal;
          localStorage.setItem(RECENT_KEY, legacyVal);
          localStorage.removeItem(k);
          break;
        }
      }
    }

    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filter using strict availability evaluator
    return parsed.filter(isProductAvailable);
  } catch {
    return [];
  }
};

/**
 * Add or update a product in the recently viewed localStorage list.
 * Only adds if the product is active, undeleted, and IN STOCK.
 */
export const addToRecentlyViewed = (product) => {
  if (!product) return;
  const realId = String(
    product.id || product.product_id || product._id || ""
  );
  if (!realId) return;

  // Do not store deleted, inactive, or out-of-stock products
  if (!isProductAvailable(product)) return;

  try {
    const list = getRecentlyViewed();
    const filtered = list.filter(
      (p) => String(p.id || p.product_id || p._id) !== realId
    );

    const newItem = {
      id: realId,
      product_id: realId,
      title: product.title || product.name || "Untitled Product",
      price: product.selling_price || product.price || 0,
      originalPrice: product.originalPrice || product.original_price || null,
      image: primaryImg(product.images, product),
      slug: product.slug || realId,
      status: product.status || "active",
      stock: product.stock ?? 1000,
      is_active: product.is_active ?? true,
      variants: product.variants || [],
      updatedAt: Date.now(),
    };

    filtered.unshift(newItem);
    // Retain top 12 items max
    localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, 12)));
  } catch (e) {
    console.error("addToRecentlyViewed error:", e);
  }
};

/**
 * Validates cached recently viewed items against the live backend API.
 * Automatically purges soft-deleted, unapproved, hidden, removed, OR OUT OF STOCK products.
 */
export const syncRecentlyViewed = async () => {
  try {
    const list = getRecentlyViewed();
    if (!Array.isArray(list) || list.length === 0) {
      localStorage.setItem(RECENT_KEY, "[]");
      return [];
    }

    const itemsToVerify = list.filter(
      (item) => item && (item.id || item.product_id || item._id)
    );

    if (!itemsToVerify.length) {
      localStorage.setItem(RECENT_KEY, "[]");
      return [];
    }

    // Verify all items in parallel against live API
    const checks = await Promise.allSettled(
      itemsToVerify.map(async (item) => {
        const id = item.id || item.product_id || item._id;
        const res = await fetch(`${API}/products/${id}`);
        if (!res.ok) return null; // 404/500 -> Purge item
        const json = await res.json();
        return json?.data || null;
      })
    );

    const validList = [];

    checks.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value) {
        const live = result.value;

        // Strict live check for deletion, status, and stock availability
        if (isProductAvailable(live)) {
          const original = itemsToVerify[idx];
          validList.push({
            ...original,
            id: live.id,
            product_id: live.id,
            title: live.title || live.name || original.title,
            price: live.selling_price || live.price || original.price,
            originalPrice:
              live.originalPrice || live.original_price || original.originalPrice,
            image: primaryImg(live.images, live) || original.image,
            slug: live.slug || original.slug,
            status: live.status,
            stock: live.stock ?? 1000,
            is_active: live.is_active,
            variants: live.variants || original.variants || [],
          });
        }
      }
    });

    localStorage.setItem(RECENT_KEY, JSON.stringify(validList));
    return validList;
  } catch (err) {
    console.error("syncRecentlyViewed error:", err);
    return getRecentlyViewed();
  }
};