require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");

const paystackWebhookHandler = require("./paystackWebhook");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= DATABASE ================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("MongoDB Error:", err));

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

// Paystack needs raw body
app.use("/api/paystack/webhook", express.raw({ type: "application/json" }));

/* ================= ROUTES ================= */
app.use("/api/marketplace", require("./routes/marketplaceRoutes"));
app.use("/api/minimart", require("./routes/minimartRoutes"));
app.use("/api/users", require("./routes/userRoutes")); // optional (Auth0 sync)

/* ================= PAYSTACK WEBHOOK ================= */
app.post("/api/paystack/webhook", (req, res) =>
  paystackWebhookHandler(req, res)
);

/* ================= SERVE FRONTEND (VITE BUILD) ================= */
const frontendPath = path.join(__dirname, "../dist");
app.use(express.static(frontendPath));

// React Router fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

/* ================= START SERVER ================= */
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));