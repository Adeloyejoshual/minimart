import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// --- Helpers ---

/**
 * Fetch all products
 */
export const getAllProducts = async () => {
  const { rows } = await pool.query(
    `SELECT id, title, description, price, category, type, brand, condition, location, created_at
     FROM products
     ORDER BY created_at DESC`
  );
  return rows;
};

/**
 * Add a new product
 */
export const addProduct = async (product) => {
  const {
    title,
    description,
    price,
    category,
    type,
    brand,
    condition,
    location,
  } = product;

  const numericPrice = parseFloat(price);
  if (!title || isNaN(numericPrice)) {
    throw new Error("Title and valid price are required");
  }

  const { rows } = await pool.query(
    `INSERT INTO products
     (title, description, price, category, type, brand, condition, location)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, title, description, price, category, type, brand, condition, location, created_at`,
    [
      title.trim(),
      description?.trim() || null,
      numericPrice,
      category || null,
      type || null,
      brand || null,
      condition || null,
      location || null,
    ]
  );

  return rows[0];
};

export default pool;