import slugify from "slugify";

/* ===================== BASE SLUG ===================== */
export const generateBaseSlug = (text = "") => {
  if (typeof text !== "string") return "item";

  const cleaned = text.trim();

  if (!cleaned) return "item";

  const slug = slugify(cleaned, {
    lower: true,
    strict: true,
    trim: true,
  });

  const finalSlug = slug
    .replace(/-+/g, "-")      // collapse multiple dashes
    .replace(/^-|-$/g, "")    // trim edges
    .substring(0, 70);

  return finalSlug || "item";
};

/* ===================== UNIQUE SLUG ===================== */
export const generateSlugWithId = (title = "", id) => {
  const base = generateBaseSlug(title);

  if (!id) return base;

  return `${base}-${String(id).slice(0, 8)}`;
};