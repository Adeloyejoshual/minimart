import slugify from "slugify";

/* ===================== BASE SLUG ===================== */
export const generateBaseSlug = (text = "") => {
  if (!text || typeof text !== "string") return "item";

  const slug = slugify(text, {
    lower: true,
    strict: true,
    trim: true,
  });

  return slug
    .replace(/-+/g, "-")   // collapse multiple dashes
    .replace(/^-|-$/g, "") // remove leading/trailing dashes
    .substring(0, 70) || "item";
};

/* ===================== UNIQUE SLUG ===================== */
export const generateSlugWithId = (title = "", id) => {
  const base = generateBaseSlug(title);

  // safety fallback
  if (!id) return base;

  return `${base}-${id}`;
};