import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";

dotenv.config();

/* ================= CONFIG ================= */
const app = express();
const PORT = process.env.PORT || 5000;

/* ================= SERVER ================= */
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

/* ================= DATABASE ================= */
import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

/* ================= DB CONNECT ================= */
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ CockroachDB connected");
  } catch (err) {
    console.error("❌ DB ERROR:", err.message);
    process.exit(1);
  }
})();

/* ================= CACHE ================= */
export const cache = new Map();
const CACHE_TTL = 60 * 1000;

export const setCache = (key, value) => {
  cache.set(key, { value, time: Date.now() });
};

export const getCache = (key) => {
  const data = cache.get(key);
  if (!data) return null;

  if (Date.now() - data.time > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return data.value;
};

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of cache.entries()) {
    if (now - val.time > CACHE_TTL) cache.delete(key);
  }
}, 60000);

/* ================= SECURITY ================= */
app.use(cors());

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

/* ================= LOGGER ================= */
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.url}`);
  next();
});

/* ================= RATE LIMIT ================= */
const rateLimitMap = new Map();

app.use((req, res, next) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const now = Date.now();

  const windowMs = 2000;
  const maxReq = 60;

  let record = rateLimitMap.get(ip);

  if (!record || now - record.time > windowMs) {
    record = { count: 1, time: now };
  } else {
    record.count++;
  }

  rateLimitMap.set(ip, record);

  if (record.count > maxReq) {
    return res.status(429).json({ message: "Too many requests" });
  }

  next();
});

/* ================= CRON ================= */
import "./jobs/expirePromotions.js";

/* =========================================================
   🔥 PAYSTACK WEBHOOK (MUST COME BEFORE express.json)
   Uses ONE payment.js (webhookRouter)
========================================================= */
import paymentRouter, { webhookRouter } from "./routes/payment.js";

// Raw body only for webhook route
app.use("/api/payment/webhook", express.raw({ type: "application/json" }), webhookRouter);

// Main payment routes (JSON‑parsed body)
app.use("/api/payment", paymentRouter);

/* ================= NORMAL BODY PARSERS ================= */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ================= ROUTES ================= */
import marketplaceRouter from "./routes/marketplace.js";
import userRouter from "./routes/users.js";
import messagesRouter from "./routes/messages.js";
import adminRouter from "./routes/admin.js";
import searchRouter from "./routes/search.js";
import productDetailRouter from "./routes/productDetail.js";
import homepageRouter from "./routes/homepage.js";
import sellerProfileRouter from "./routes/sellerprofile.js";

app.use("/api/marketplace", marketplaceRouter);
app.use("/api/users", userRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/search", searchRouter);
app.use("/api/product", productDetailRouter);
app.use("/api", homepageRouter);
app.use("/api/marketplace/sellers", sellerProfileRouter);

/* ================= HEALTH ================= */
app.get("/api/health", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT 1");
    res.json({
      success: true,
      db: rows.length > 0,
      uptime: process.uptime(),
      memory: process.memoryUsage().rss,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ================= SOCKET ================= */
io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  socket.on("joinRoom", ({ senderId, receiverId, productId }) => {
    if (!senderId || !receiverId || !productId) return;
    const room = `${productId}_${[senderId, receiverId].sort().join("_")}`;
    socket.join(room);
  });

  socket.on("sendMessage", async (data) => {
    try {
      const { senderId, receiverId, productId, message } = data;
      if (!senderId || !receiverId || !productId || !message) return;

      const room = `${productId}_${[senderId, receiverId].sort().join("_")}`;

      const { rows } = await pool.query(
        `INSERT INTO messages 
         (sender_id, receiver_id, product_id, message, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [senderId, receiverId, productId, message]
      );

      io.to(room).emit("receiveMessage", rows[0]);
    } catch (err) {
      console.error("❌ Socket error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

/* ================= STATIC ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ message: "API not found" });
    }
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

/* ================= ERROR ================= */
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err);
  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

/* ================= START ================= */
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;