/**
 * mobileHelpers.js
 */

export const API =
  import.meta.env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  "/api";

export const DEFAULT_LIMIT = 24;
export const WISH_KEY = "mm_wishlist";

/**
 * Safely extracts the primary image URL from product images array or fallback object
 */
export function primaryImg(images, product) {
  if (Array.isArray(images) && images.length > 0) {
    // Find primary or first image
    const primary = images.find((i) => i?.is_primary || i?.primary) || images[0];
    if (typeof primary === "string") return primary;
    if (primary && typeof primary === "object") {
      return (
        primary.url ||
        primary.image_url ||
        primary.src ||
        primary.public_url ||
        null
      );
    }
  }

  if (product && typeof product === "object") {
    return (
      product.cover_image ||
      product.image_url ||
      product.url ||
      product.image ||
      product.thumbnail ||
      null
    );
  }

  return null;
}