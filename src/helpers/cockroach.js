// src/helpers/cockroach.js
import { Pool } from "pg";

// Pool setup — uses env variable
const pool = new Pool({
  connectionString: import.meta.env.VITE_COCKROACH_URI,
  ssl: { rejectUnauthorized: false }, // required for CockroachDB on Render/AWS
});

/**
 * Fetch all MiniMart products
 */
export async function getProducts() {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, description, price, stock, category, image_url, created_at
       FROM minimart_products
       ORDER BY created_at DESC`
    );
    return rows;
  } catch (err) {
    console.error("Cockroach getProducts error:", err);
    throw err;
  }
}

/**
 * Fetch single MiniMart product by ID
 */
export async function getProductById(id) {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, description, price, stock, category, image_url, created_at
       FROM minimart_products
       WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  } catch (err) {
    console.error("Cockroach getProductById error:", err);
    throw err;
  }
}

/**
 * Add new MiniMart product
 */
export async function addProduct({ title, description, price, stock, category, image_url }) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO minimart_products (title, description, price, stock, category, image_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, description, price, stock, category, image_url, created_at`,
      [title, description || null, price, stock || 0, category || null, image_url || null]
    );
    return rows[0];
  } catch (err) {
    console.error("Cockroach addProduct error:", err);
    throw err;
  }
}