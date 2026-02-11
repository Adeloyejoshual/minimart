import pkg from "pg";
const { Pool } = pkg;

// Pool connection to CockroachDB (Render SSL required)
const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// Get all products
export async function getAllMiniMartProducts() {
  const { rows } = await pool.query(
    "SELECT id, title, description, price, created_at FROM products ORDER BY created_at DESC"
  );
  return rows;
}

// Add a new product
export async function addMiniMartProduct({ title, description, price }) {
  if (!title || !price) throw new Error("Title and price are required");

  const numericPrice = parseFloat(price);
  if (isNaN(numericPrice)) throw new Error("Price must be a number");

  const query = `
    INSERT INTO products (title, description, price)
    VALUES ($1, $2, $3)
    RETURNING id, title, description, price, created_at
  `;
  const { rows } = await pool.query(query, [title.trim(), description?.trim() || null, numericPrice]);
  return rows[0];
}