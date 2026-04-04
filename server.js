import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { Pool } from "pg";
import dotenv from "dotenv";

/* ================= CONFIG ================= */
dotenv.config();

/* ================= APP ================= */
const app = express();
const PORT = process.env.PORT || 5000;

/* ================= SERVER ================= */
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

/* ================= DATABASE ================= */
export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// Test DB on startup
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

export const setCache = (key, value) =>
  cache.set(key, { value, time: Date.now() });

export const getCache = (key) => {
  const data = cache.get(key);
  if (!data || Date.now() - data.time > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return data.value;
};

// clean cache every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key] of cache.entries()) {
    if (now - cache.get(key).time > CACHE_TTL) cache.delete(key);
  }
}, 60_000);

/* ================= SECURITY MIDDLEWARE ================= */
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  next();
});

/* ================= LOGGER ================= */
app.use((req, res, next) => {
  const start = Date.now();
  const logLine = `${new Date().toISOString()} | ${req.method} ${req.url}`;
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${logLine} | ${res.statusCode} | ${duration}ms`);
  });
  next();
});

/* ================= RATE LIMITING (IP‑BASED) ================= */
const rateLimitMap = new Map();
const windowMs = 15 * 60 * 1000; // 15 minutes
const maxReq = 1000;

app.use((req, res, next) => {
  const ip =
    req.headers["x-forwarded-for"]
      ?.split(",")
      .map((x) => x.trim())[0] || req.socket.remoteAddress;

  const now = Date.now();
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
      error: "Too many requests. Try again later.",
    });
  }
  next();
});

/* ================= WEBHOOKS FIRST (RAW BODY) ================= */
// ✅ paymentRouter already includes:
// - /api/payments/webhook
// - /api/payments/initialize
// - /api/payments/verify
// - /api/payments/free-plan/:id
import paymentRouter from "./routes/payment.js";

app.use("/api/payments/webhook", paymentRouter);
app.use("/api/webhooks/paystack", paymentRouter);
app.use("/api/payment/webhook", paymentRouter);

/* ================= BODY PARSERS ================= */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true })); // form
app.use(express.raw({ type: "application/json" })); // fallback for raw JSON

/* ================= APPLICATION ROUTES ================= */
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
app.use("/api/payments", paymentRouter);
app.use("/api", homepageRouter);
app.use("/api/marketplace/sellers", sellerProfileRouter);

/* ================= HEALTH CHECKS ================= */
app.get("/api/health", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT 1 AS health");

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      db: rows[0]?.health === 1,
      cache_size: cache.size,
      routes: true,
      payments: true,
      env: {
        paystack: !!process.env.PAYSTACK_SECRET_KEY,
        db: !!process.env.COCKROACH_URI,
        frontend: !!process.env.FRONTEND_URL,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Database unavailable",
      details: err.message,
    });
  }
});

app.get("/api/payments/health", (req, res) => {
  res.json({
    status: "ok",
    endpoints: ["/initialize", "/verify", "/webhook", "/free-plan/:id"],
    timestamp: new Date().toISOString(),
    paystack_key: process.env.PAYSTACK_SECRET_KEY ? "configured" : "missing",
  });
});

/* ================= SOCKET.IO (MESSAGING) ================= */
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
        `
        INSERT INTO messages (sender_id, receiver_id, product_id, message, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
        `,
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

/* ================= PRODUCTION STATIC FILES ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === "production") {
  app.use(
    express.static(path.join(__dirname, "dist"), {
      maxAge: "1y",
      index: false,
    })
  );

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({
        success: false,
        message: "API endpoint not found",
      });
    }
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

/* ================= ERROR HANDLERS ================= */
app.use((err, req, res, next) => {
  console.error("🔥 GLOBAL ERROR:", {
    url: req.url,
    method: req.method,
    error: err.message,
    stack: err.stack,
    body: req.body,
  });

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: "Payload too large",
    });
  }

  res.status(500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

app.use("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      message: "API route not found",
    });
  }
  res.status(404).send("Not Found");
});

/* ================= SERVER START + SHUTDOWN ================= */
const startServer = () => {
  server.listen(PORT, "0.0.0.0", () => {
    const baseUrl =
      process.env.NODE_ENV === "production"
        ? `https://minimart-ivrm.onrender.com`
        : `http://localhost:${PORT}`;

    console.log(`🚀 Server running → ${baseUrl}`);
    console.log(`📊 Health → ${baseUrl}/api/health`);
    console.log(`💳 Payments → ${baseUrl}/api/payments/health`);
    console.log(`🪝 Webhook → ${baseUrl}/api/payments/webhook`);

    if (process.env.NODE_ENV === "production") {
      console.log(`🌐 Production Mode`);
      console.log(
        `🔗 Frontend Callback: ${process.env.FRONTEND_URL || baseUrl}`
      );
      console.log(`🔑 Paystack Configured: ${!!process.env.PAYSTACK_SECRET_KEY}`);
    } else {
      console.log(`🔧 Development Mode`);
    }
  });
};

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  server.close(() => {
    pool.end().then(() => process.exit(0));
  });
});

startServer();

export default app;