/**
 * src/loemart/mobile/mobileHelpers.js
 * Mobile helper utilities, API routes, image resolvers, and recently viewed sync
 */

export const API =
  import.meta.env.VITE_API_URL || "https://loemart.com/api";

export const RECENT_KEY = "lm-recently-viewed";

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
   RECENTLY VIEWED (BASED ON YOUR VIEWS) HELPERS
════════════════════════════════════════════════════════════ */

/**
 * Get recently viewed products cached in localStorage.
 * Performs a preliminary client-side filter against static soft-delete markers.
 */
export const getRecentlyViewed = () => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item) =>
        item &&
        (item.id || item.product_id || item._id) &&
        item.status !== "deleted" &&
        !item.deleted_at
    );
  } catch {
    return [];
  }
};

/**
 * Add or update a product in the recently viewed localStorage list.
 */
export const addToRecentlyViewed = (product) => {
  if (!product) return;
  const realId = String(
    product.id || product.product_id || product._id || ""
  );
  if (!realId) return;

  // Do not store deleted or inactive products
  if (
    product.deleted_at ||
    product.status === "deleted" ||
    product.is_active === false
  ) {
    return;
  }

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
 * Validates cached recently viewed items against the live API.
 * Automatically purges soft-deleted, unapproved, hidden, or removed products from localStorage.
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
        if (!res.ok) return null;
        const json = await res.json();
        return json?.data || null;
      })
    );

    const validList = [];

    checks.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value) {
        const live = result.value;

        const isApprovedOrActive =
          live.status === "approved" || live.status === "active";
        const isNotDeleted =
          !live.deleted_at && live.status !== "deleted";
        const isActive =
          live.is_active !== false &&
          live.is_hidden !== true &&
          live.is_paused !== true;

        if (isApprovedOrActive && isNotDeleted && isActive) {
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