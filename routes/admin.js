import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});


// ---------------- GET ALL CATEGORIES ----------------
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM categories ORDER BY name ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});


// ---------------- CREATE CATEGORY ----------------
router.post("/categories", async (req, res) => {
  try {
    const { name, fields } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO categories (name, fields)
       VALUES ($1, $2)
       RETURNING *`,
      [name, JSON.stringify(fields)]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create category" });
  }
});


// ---------------- UPDATE CATEGORY ----------------
router.put("/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, fields } = req.body;

    const { rows } = await pool.query(
      `UPDATE categories
       SET name = $1, fields = $2
       WHERE id = $3
       RETURNING *`,
      [name, JSON.stringify(fields), id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update category" });
  }
});


// ---------------- DELETE CATEGORY ----------------
router.delete("/categories/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM categories WHERE id = $1", [req.params.id]);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete category" });
  }
});

export default router;