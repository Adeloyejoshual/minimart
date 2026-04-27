// src/utils/slug.js
import { pool } from "../config/db.js";

const generateBaseSlug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9s-]/g, "")
    .replace(/s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);

const generateUniqueSlug = async (title) => {
  const base = generateBaseSlug(title);

  let slug = base;
  let counter = 1;

  while (true) {
    const { rowCount } = await pool.query(
      "SELECT 1 FROM products WHERE slug = $1",
      [slug]
    );
    if (rowCount === 0) break;

    slug = `${base}-${counter++}`;
  }

  return slug;
};

export { generateBaseSlug, generateUniqueSlug }; // named exports