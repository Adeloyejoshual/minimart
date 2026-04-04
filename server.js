import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";

/* ================= CONFIG ================= */
dotenv.config();

/* ================= CRON ================= */
import "./jobs/expirePromotions.js";

/* ================= APP ================= */
const app = express();
const PORT = process.env.PORT || 5000;

/* ================= SERVER ================= */
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { 
    origin: process.env.FRONTEND_URL || "*", 
    methods: ["GET", "POST"],
    credentials: true 
  },
});

/* ================= DATABASE ================= */
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

export const setCache = (key, value) => cache.set(key, { value, time: Date.now() });
export const getCache = (key) => {
  const data = cache.get(key);
  if (!data || Date.now() - data.time > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return data.value;
};

setInterval(() => {
  const now = Date.now();
  for (const [key] of cache.entries()) {
    if (now - cache.get(key).time > CACHE_TTL) cache.delete(key);
  }
}, 60000);

/* ================= SECURITY ================= */
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

/* ================= LOGGER ================= */
app.use((req, res, next) => {
  const start = Date.now();
  const log = `${new Date().toISOString()} | ${req.method} ${req.url}`;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${log} | ${res.statusCode} | ${duration}ms`);
  });
  next();
});

/* ================= RATE LIMIT ================= */
const rateLimitMap = new Map();
app.use((req, res, next) => {
  const ip = req.headers["x-forwarded-for"]?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxReq = 1000;

  let record = rateLimitMap.get(ip);
  if (!record || now - record.time > windowMs) {
    record = { count: 1, time: now };
  } else {
    record.count++;
  }
  rateLimitMap.set(ip, record);

  if (record.count > maxReq) {
    return res.status(429).json({ success: false, error: "Too many requests" });
  }
  next();
});

/* =========================================================
   🚨 WEBHOOKS FIRST (raw body) - BEFORE JSON PARSER
========================================================= */
import paymentRouter from "./routes/payment.js";

// ✅ Webhooks ONLY (raw body required)
app.use(express.raw({ type: "application/json" }));
app.use("/api/payments/webhook", paymentRouter);
app.use("/api/webhooks/paystack", paymentRouter);
app.use("/api/payment/webhook", paymentRouter);

/* ================= BODY PARSERS (AFTER WEBHOOKS) ================= */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// ✅ CRITICAL: MAIN PAYMENT ROUTES
app.use("/api/payment", paymentRouter);  // ← initialize/verify/free-plan/health
app.use("/api/payments", paymentRouter); // ← Legacy support

/* ================= OTHER ROUTES ================= */
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

/* ================= HEALTH CHECKS ================= */
app.get("/api/health", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT 1 as health");
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      db: rows[0]?.health === 1,
      cache_size: cache.size,
      payments: true,
      endpoints: {
        payment_init: "/api/payment/initialize",
        payment_verify: "/api/payment/verify",
        free_plan: "/api/payment/free-plan/:id"
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Database unavailable" });
  }
});

// ✅ PAYMENT HEALTH - TEST THIS FIRST
app.get("/api/payment/health", (req, res) => {
  res.json({ 
    success: true,
    status: "Payment routes active ✅",
    endpoints: [
      "POST /api/payment/initialize",
      "POST /api/payment/verify", 
      "POST /api/payment/free-plan/:id",
      "POST /api/payments/webhook"
    ],
    paystack: !!process.env.PAYSTACK_SECRET_KEY ? "✅ Configured" : "❌ Missing",
    timestamp: new Date().toISOString()
  });
});

/* ================= SOCKET.IO ================= */
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);
  socket.on("joinRoom", ({ senderId, receiverId, productId }) => {
    if (!senderId || !receiverId || !productId) return;
    const room = `product_${productId}_${[senderId, receiverId].sort().join("_")}`;
    socket.join(room);
    console.log(`📱 ${socket.id} joined: ${room}`);
  });

  socket.on("sendMessage", async (data) => {
    try {
      const { senderId, receiverId, productId, message } = data;
      if (!senderId || !receiverId || !productId || !message?.trim()) return;

      const room = `product_${productId}_${[senderId, receiverId].sort().join("_")}`;
      const { rows } = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, product_id, message, created_at)
         VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
        [senderId, receiverId, productId, message.trim()]
      );
      io.to(room).emit("receiveMessage", rows[0]);
    } catch (err) {
      console.error("❌ Socket error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ Socket ${socket.id} disconnected`);
  });
});

/* ================= PRODUCTION STATIC ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist"), { maxAge: "1y", index: false }));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ success: false, message: "API not found" });
    }
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

/* ================= ERROR HANDLERS ================= */
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", { url: req.url, method: req.method, error: err.message });
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === "production" ? "Server error" : err.message
  });
});

app.use("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, message: "Route not found" });
  }
  res.status(404).send("Not Found");
});

/* ================= START SERVER ================= */
const startServer = () => {
  server.listen(PORT, "0.0.0.0", () => {
    const baseUrl = process.env.NODE_ENV === "production" 
      ? `https://minimart-ivrm.onrender.com`
      : `http://localhost:${PORT}`;
    
    console.log(`
🚀 Server ready → ${baseUrl}`);
    console.log(`📊 Health → ${baseUrl}/api/health`);
    console.log(`💳 Payments → ${baseUrl}/api/payment/health`);  // ← TEST THIS
    console.log(`🪝 Webhook → ${baseUrl}/api/payments/webhook`);
    console.log(`✅ All routes active
`);
  });
};

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down...');
  server.close(() => {
    pool.end().then(() => process.exit(0));
  });
});

startServer();
export default app;