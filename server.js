// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ================= MIDDLEWARE =================
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ================= TEST ROUTES =================
app.get("/", (req, res) => {
  res.send("✅ Server is running!");
});

// Example API route
app.get("/api/marketplace", (req, res) => {
  res.json({
    products: [
      { id: 1, name: "Laptop" },
      { id: 2, name: "Smartphone" },
      { id: 3, name: "Headphones" },
    ],
  });
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});