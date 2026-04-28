// utils/slug.js

export const generateBaseSlug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")   // keep letters, numbers, space, hyphen
    .replace(/\s+/g, "-")           // spaces → hyphen
    .replace(/-+/g, "-")            // remove duplicate hyphens
    .replace(/^-+|-+$/g, "")        // trim hyphens
    .substring(0, 70);              // limit length

export const generateSlugWithId = (title, id) => {
  return `${generateBaseSlug(title)}-${id}`;
};