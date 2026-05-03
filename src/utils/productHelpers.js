/**
 * utils/productHelpers.js
 * Pure, side-effect-free helpers shared across Homepage & SectionFeed pages.
 */

export const PH =
  "https://placehold.co/600x500/e8e4dc/b0a89e?text=No+Image";

/** Format a number as Nigerian Naira */
export const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

/** True if the date is less than 24 hours old */
export const fresh = (d) =>
  d && Date.now() - new Date(d).getTime() < 86_400_000;

/** Resolve the best image URL from a product object */
export const getImageUrl = (p) => {
  if (p?.image) return p.image;
  if (Array.isArray(p?.images) && p.images.length > 0) {
    const f = p.images[0];
    return typeof f === "string" ? f : f?.url || f?.thumbnail_url || PH;
  }
  return p?.thumbnail_url || p?.main_image || PH;
};

/** De-duplicate a product array by `id` */
export const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => !seen.has(p.id) && seen.add(p.id));
};

/** Return badge metadata or null */
export const getBadge = (p) => {
  if (p.is_promoted)        return { text: "Sponsored", cls: "bd-feat" };
  if ((p.ctr || 0) > 0.15) return { text: "Hot 🔥",    cls: "bd-hot"  };
  if ((p.ctr || 0) > 0.08) return { text: "Trending",  cls: "bd-trnd" };
  if (fresh(p.created_at))  return { text: "New",       cls: "bd-new"  };
  return null;
};

/** Human-readable location label */
export const locLabel = (loc) => {
  if (!loc) return "Nationwide";
  if (loc.label) return loc.label;
  return [loc.city, loc.state].filter(Boolean).join(", ") || "Nationwide";
};

/** Client-side sort for SectionFeed */
export const applySortClient = (products, sortKey) => {
  const arr = [...products];
  switch (sortKey) {
    case "price_asc":
      return arr.sort((a, b) => a.price - b.price);
    case "price_desc":
      return arr.sort((a, b) => b.price - a.price);
    case "newest":
      return arr.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
    case "engagement":
      return arr.sort(
        (a, b) => (b.engagement_score || 0) - (a.engagement_score || 0)
      );
    case "clicks":
      return arr.sort(
        (a, b) => (b.clicks_count || 0) - (a.clicks_count || 0)
      );
    default:
      return arr;
  }
};
