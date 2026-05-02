import express          from "express";
import cors             from "cors";
import path             from "path";
import http             from "http";
import dotenv           from "dotenv";
import { fileURLToPath } from "url";
import { Server as SocketIOServer } from "socket.io";
import { Pool }         from "pg";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/* =========================================
   APP + SERVER
========================================= */
const app    = express();
const PORT   = process.env.PORT || 5000;
const server = http.createServer(app);

/* =========================================
   SOCKET.IO
========================================= */
const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || "*";

const io = new SocketIOServer(server, {
  cors: {
    origin:  ALLOWED_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

/* =========================================
   DATABASE
========================================= */
export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Database connected");
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  }
})();

/* =========================================
   SIMPLE IN-MEMORY CACHE
========================================= */
const cache     = new Map();
const CACHE_TTL = 60 * 1000; // 1 min

export const setCache = (key, value) => {
  cache.set(key, { value, time: Date.now() });
};

export const getCache = (key) => {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.time > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return item.value;
};

// Evict stale entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of cache.entries()) {
    if (now - item.time > CACHE_TTL) cache.delete(key);
  }
}, 60_000);

/* =========================================
   SECURITY HEADERS
========================================= */
app.use(cors({ origin: ALLOWED_ORIGIN }));

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

/* =========================================
   REQUEST LOGGER
========================================= */
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.originalUrl}`);
  next();
});

/* =========================================
   RATE LIMITER
========================================= */
const limiter   = new Map();
const WINDOW_MS = 60_000; // 1-minute sliding window
const MAX_REQ   = 120;    // requests per window

// Evict stale IP buckets every 5 minutes to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of limiter.entries()) {
    if (now - data.time > WINDOW_MS) limiter.delete(ip);
  }
}, 5 * 60_000);

app.use((req, res, next) => {
  const ip  = req.headers["x-forwarded-for"]?.split(",")[0].trim()
              ?? req.socket.remoteAddress
              ?? "unknown";
  const now = Date.now();
  let data  = limiter.get(ip);

  if (!data || now - data.time > WINDOW_MS) {
    data = { count: 1, time: now };
  } else {
    data.count++;
  }

  limiter.set(ip, data);

  if (data.count > MAX_REQ) {
    return res.status(429).json({ success: false, message: "Too many requests" });
  }

  next();
});

/* =========================================
   PAYSTACK WEBHOOK  (must come before body-parser)
   Webhook needs the raw Buffer; all other payment
   routes use parsed JSON — so mount them here, in
   this exact order, before express.json() runs.
========================================= */
import paymentRouter, { webhookRouter } from "./routes/payment.js";

app.use(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  webhookRouter
);

/* =========================================
   BODY PARSERS
   Must be registered BEFORE any route that
   reads req.body, and AFTER the raw webhook.
========================================= */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* =========================================
   PAYMENT ROUTES  (need parsed JSON body)
========================================= */
app.use("/api/payment", paymentRouter);

/* =========================================
   CRON JOBS
========================================= */
import "./jobs/expirePromotions.js";

/* =========================================
   API ROUTES
========================================= */
import marketplaceRouter   from "./routes/addproduct.js";
import userRouter          from "./routes/users.js";
import messagesRouter      from "./routes/messages.js";
import adminRouter         from "./routes/admin.js";
import searchRouter        from "./routes/search.js";
import productDetailRouter from "./routes/productDetail.js";
import homepageRouter      from "./routes/homepage.js";
import sellerProfileRouter from "./routes/sellerprofile.js";

app.use("/api/marketplace/sellers", sellerProfileRouter); // more specific first
app.use("/api/marketplace",         marketplaceRouter);
app.use("/api/users",               userRouter);
app.use("/api/messages",            messagesRouter);
app.use("/api/admin",               adminRouter);
app.use("/api/search",              searchRouter);
app.use("/api/product",             productDetailRouter);
app.use("/api",                     homepageRouter);

/* =========================================
   HEALTH CHECK
========================================= */
app.get("/api/health", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT 1");
    return res.json({
      success:  true,
      database: rows.length > 0,
      uptime:   process.uptime(),
      memory:   process.memoryUsage().rss,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   STATIC FILES  (production only)
========================================= */
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "dist");
  app.use(express.static(distPath));

  // SPA fallback — serve index.html for every non-API GET
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({
        success: false,
        message: `API route not found: ${req.method} ${req.originalUrl}`,
      });
    }
    res.sendFile(path.join(distPath, "index.html"));
  });
}

/* =========================================
   404 — unmatched routes  (dev + prod /api/*)
   Must come after all routes, before the error
   handler.
========================================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

/* =========================================
   GLOBAL ERROR HANDLER
   Must be the very last app.use() call and
   must have exactly four parameters so Express
   recognises it as an error handler.
========================================= */
app.use((err, req, res, _next) => {
  console.error("🔥 Unhandled error:", err);

  // ── Multer validation errors ──────────────────────────
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ success: false, message: "File too large (max 3 MB per file)" });
  }
  if (err.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({ success: false, message: "Too many files (max 6)" });
  }
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ success: false, message: "Unexpected file field" });
  }
  if (err.message === "Only images allowed") {
    return res.status(400).json({ success: false, message: err.message });
  }

  // ── HTTP errors with explicit status ─────────────────
  const status = err.status ?? err.statusCode ?? 500;

  // Never leak stack traces or internal messages in production
  const message =
    process.env.NODE_ENV === "production" && status === 500
      ? "Internal server error"
      : err.message ?? "Internal server error";

  // Always return JSON, never HTML — prevents the
  // "Unexpected token '<'" parse error on the client
  res.status(status).json({ success: false, message });
});

/* =========================================
   SOCKET.IO
========================================= */
io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  socket.on("joinRoom", ({ senderId, receiverId, productId }) => {
    if (!senderId || !receiverId || !productId) return;
    const room = `${productId}_${[senderId, receiverId].sort().join("_")}`;
    socket.join(room);
  });

  socket.on("sendMessage", async (data) => {
    const { senderId, receiverId, productId, message } = data ?? {};
    if (!senderId || !receiverId || !productId || !message) return;

    try {
      const room = `${productId}_${[senderId, receiverId].sort().join("_")}`;
      const { rows } = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, product_id, message, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [senderId, receiverId, productId, message]
      );
      io.to(room).emit("receiveMessage", rows[0]);
    } catch (err) {
      console.error("❌ Socket message error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

/* =========================================
   START
========================================= */
server.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});

export { io };
export default app;
