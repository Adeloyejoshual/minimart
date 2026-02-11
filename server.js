import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { getAllMiniMartProducts, addMiniMartProduct } from "./src/helpers/minimartHelper.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- API routes ---

// GET all MiniMart products
app.get("/api/minimart", async (req, res) => {
  try {
    const products = await getAllMiniMartProducts();
    res.json(products);
  } catch (err) {
    console.error("GET /api/minimart error:", err);
    res.status(500).json({ message: "Failed to fetch products", error: err.message });
  }
});

// POST new MiniMart product
app.post("/api/minimart", async (req, res) => {
  try {
    const product = await addMiniMartProduct(req.body);
    res.status(201).json(product);
  } catch (err) {
    console.error("POST /api/minimart error:", err);
    res.status(400).json({ message: "Failed to add product", error: err.message });
  }
});

// --- Serve frontend ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🚀 MiniMart running on port ${PORT}`);
});