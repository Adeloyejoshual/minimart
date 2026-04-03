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

// Auto-clean cache
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
  const windowMs = 15 * 60 * 1000; // 15min
  const maxReq = 1000;

  let record = rateLimitMap.get(ip);
  if (!record || now - record.time > windowMs) {
    record = { count: 1, time: now };
  } else {
    record.count++;
  }
  rateLimitMap.set(ip, record);

  if (record.count > maxReq) {
    return res.status(429).json({ 
      success: false, 
      error: "Too many requests. Try again later." 
    });
  }
  next();
});

/* =========================================================
   🚨 CRITICAL: PAYSTACK WEBHOOK BEFORE JSON PARSER
========================================================= */
import paystackWebhook from "./routes/paystackWebhook.js";
app.use("/api/webhooks/paystack", paystackWebhook);  // ✅ CORRECTED PATH
app.use("/api/payment/webhook", express.raw({ type: "application/json" }), paystackWebhook);  // ✅ BACKWARD COMPAT

/* ================= BODY PARSERS ================= */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use(express.raw({ type: "application/json" })); // Fallback for webhooks

/* ================= ROUTES ================= */
import marketplaceRouter from "./routes/marketplace.js";
import userRouter from "./routes/users.js";
import messagesRouter from "./routes/messages.js";
import adminRouter from "./routes/admin.js";
import searchRouter from "./routes/search.js";
import productDetailRouter from "./routes/productDetail.js";
import paymentRouter from "./routes/payment.js";
import homepageRouter from "./routes/homepage.js";
import sellerProfileRouter from "./routes/sellerprofile.js";

app.use("/api/marketplace", marketplaceRouter);
app.use("/api/users", userRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/search", searchRouter);
app.use("/api/product", productDetailRouter);
app.use("/api/payment", paymentRouter);
app.use("/api", homepageRouter);
app.use("/api/marketplace/sellers", sellerProfileRouter);

/* ================= WEBHOOK HEALTH ================= */
app.get("/api/webhooks/health", (req, res) => {
  res.json({ 
    status: "ok", 
    webhook: "ready", 
    timestamp: new Date().toISOString(),
    paystack_key: process.env.PAYSTACK_SECRET_KEY ? "configured" : "missing"
  });
});

/* ================= COMPREHENSIVE HEALTH ================= */
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
      routes: true,
      env: {
        paystack: !!process.env.PAYSTACK_SECRET_KEY,
        db: !!process.env.COCKROACH_URI,
        frontend: !!process.env.FRONTEND_URL
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: "Database unavailable",
      details: err.message 
    });
  }
});

/* ================= SOCKET.IO ================= */
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("joinRoom", ({ senderId, receiverId, productId }) => {
    if (!senderId || !receiverId || !productId) return;
    const room = `product_${productId}_${[senderId, receiverId].sort().join("_")}`;
    socket.join(room);
    console.log(`📱 ${socket.id} joined room: ${room}`);
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
      console.log(`💬 Message sent in room: ${room}`);
    } catch (err) {
      console.error("❌ Socket message error:", err.message);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ Socket ${socket.id} disconnected: ${reason}`);
  });
});

/* ================= PRODUCTION STATIC ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist"), {
    maxAge: "1y",
    index: false
  }));

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ 
        success: false, 
        message: "API endpoint not found" 
      });
    }
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

/* ================= COMPREHENSIVE ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error("🔥 GLOBAL ERROR:", {
    url: req.url,
    method: req.method,
    error: err.message,
    stack: err.stack,
    body: req.body
  });

  // Handle multer/parsing errors specifically
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ 
      success: false, 
      error: "Payload too large" 
    });
  }

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === "production" 
      ? "Internal server error" 
      : err.message
  });
});

/* ================= 404 HANDLER ================= */
app.use("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ 
      success: false, 
      message: "API route not found" 
    });
  }
  res.status(404).send("Not Found");
});

/* ================= START SERVER ================= */
const startServer = () => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running → http://localhost:${PORT}`);
    console.log(`📊 Health → http://localhost:${PORT}/api/health`);
    console.log(`🔗 Webhook → http://localhost:${PORT}/api/webhooks/paystack`);
    
    if (process.env.NODE_ENV === "production") {
      console.log(`🌐 Frontend: ${process.env.FRONTEND_URL}`);
    }
  });
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    pool.end().then(() => process.exit(0));
  });
});

startServer();

export default app;