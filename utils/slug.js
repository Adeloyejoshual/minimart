// utils/slug.js

export const generateBaseSlug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 70);

export const generateSlugWithId = (title, id) => {
  return `${generateBaseSlug(title)}-${id}`;
};