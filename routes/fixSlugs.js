import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

/* ================= DB ================= */
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= SLUG GENERATOR ================= */
const generateSlug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

/* ================= MAIN SCRIPT ================= */
const fixSlugs = async () => {
  const client = await pool.connect();

  try {
    console.log("🚀 Starting slug cleanup...");

    const { rows } = await client.query(`
      SELECT id, title
      FROM products
    `);

    console.log(`📦 Found ${rows.length} products`);

    for (let i = 0; i < rows.length; i++) {
      const product = rows[i];

      if (!product.title) continue;

      const baseSlug = generateSlug(product.title);

      // check duplicates
      const existing = await client.query(
        "SELECT slug FROM products WHERE slug LIKE $1 AND id != $2",
        [`${baseSlug}%`, product.id]
      );

      let finalSlug =
        existing.rows.length > 0
          ? `${baseSlug}-${existing.rows.length + 1}`
          : baseSlug;

      await client.query(
        "UPDATE products SET slug = $1 WHERE id = $2",
        [finalSlug, product.id]
      );

      console.log(`✔ Updated: ${product.title} → ${finalSlug}`);
    }

    console.log("🎉 All slugs updated successfully!");
  } catch (err) {
    console.error("❌ Error fixing slugs:", err);
  } finally {
    client.release();
    await pool.end();
  }
};

fixSlugs();