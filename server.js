import 'dotenv/config';         // loads environment variables
import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
app.use(cors({
  origin: "https://minimart-8k9g.onrender.com"
}));
app.use(express.json());

// CockroachDB connection
const pool = new Pool({
  connectionString: process.env.COCKROACHDB_URL,
  ssl: { rejectUnauthorized: false }
});

// Create table if not exists
await pool.query(`
  CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name STRING,
    price STRING
  );
`);

app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ dbTime: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/products", async (req, res) => {
  const { name, price } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO products (name, price) VALUES ($1, $2) RETURNING *",
      [name, price]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/products", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));