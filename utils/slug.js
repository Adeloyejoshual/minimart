import slugify from "slugify";

/**
 * Create clean SEO slug from text
 */
export const generateBaseSlug = (text) =>
  slugify(text || "", {
    lower: true,
    strict: true,
    trim: true,
  }).substring(0, 70);

/**
 * Attach ID to ensure uniqueness
 */
export const generateSlugWithId = (title, id) =>
  `${generateBaseSlug(title)}-${id}`;