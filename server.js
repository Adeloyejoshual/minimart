import express           from "express";
import cors              from "cors";
import path              from "path";
import http              from "http";
import dotenv            from "dotenv";
import { fileURLToPath } from "url";
import { Pool }          from "pg";
import { initSocket, getOnlineCount } from "./socket.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/* ═══════════════════════════════════════════
   APP + HTTP SERVER
═══════════════════════════════════════════ */
const app    = express();
const PORT   = process.env.PORT || 5000;
const server = http.createServer(app);

/* ═══════════════════════════════════════════
   DATABASE — CockroachDB via pg Pool
═══════════════════════════════════════════ */
export const pool = new Pool({
  connectionString        : process.env.COCKROACH_URI,
  ssl                     : { rejectUnauthorized: false },
  max                     : 10,
  idleTimeoutMillis       : 30_000,
  connectionTimeoutMillis : 5_000,
});

(async () => {
  try {
    const { rows } = await pool.query("SELECT version()");
    console.log("✅ CockroachDB connected:", rows[0].version.split(" ")[0]);
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  }
})();

pool.on("error", (err) => {
  console.error("🔥 Unexpected pool error:", err.message);
});

/* ═══════════════════════════════════════════
   SOCKET.IO
═══════════════════════════════════════════ */
const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || "*";
export const io = initSocket(server, ALLOWED_ORIGIN);

/* ═══════════════════════════════════════════
   IN-MEMORY CACHE (LRU-style with TTL)
═══════════════════════════════════════════ */
const _cache    = new Map();
const CACHE_TTL = 60_000;

export function setCache(key, value, ttl = CACHE_TTL) {
  _cache.set(key, { value, expires: Date.now() + ttl });
}

export function getCache(key) {
  const item = _cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    _cache.delete(key);
    return null;
  }
  return item.value;
}

export function deleteCache(key) {
  _cache.delete(key);
}

export function clearCachePattern(prefix) {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, item] of _cache.entries()) {
    if (now > item.expires) _cache.delete(key);
  }
}, 60_000);

/* ═══════════════════════════════════════════
   CORS
═══════════════════════════════════════════ */
const corsOptions = {
  origin(origin, cb) {
    if (!origin || ALLOWED_ORIGIN === "*") return cb(null, true);
    const allowed = ALLOWED_ORIGIN.split(",").map((s) => s.trim());
    if (allowed.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials    : true,
  methods        : ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders : ["Content-Type", "Authorization", "x-requested-with"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ═══════════════════════════════════════════
   SECURITY HEADERS
═══════════════════════════════════════════ */
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options",        "DENY");
  res.setHeader("X-XSS-Protection",       "1; mode=block");
  res.setHeader("Referrer-Policy",        "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self)"
  );
  next();
});

/* ═══════════════════════════════════════════
   STATIC — uploaded chat images
═══════════════════════════════════════════ */
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge       : "7d",
    etag         : true,
    lastModified : true,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html") || filePath.endsWith(".htm")) {
        res.setHeader("Content-Type", "text/plain");
      }
    },
  })
);

/* ═══════════════════════════════════════════
   PAYSTACK WEBHOOK
   raw body MUST come before express.json()
═══════════════════════════════════════════ */
import paymentRouter, { webhookRouter } from "./routes/payment.js";

app.use(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  webhookRouter
);

/* ═══════════════════════════════════════════
   BODY PARSERS
═══════════════════════════════════════════ */
app.use(express.json({       limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ═══════════════════════════════════════════
   REQUEST LOGGER
═══════════════════════════════════════════ */
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== "test") {
    console.log(
      `${new Date().toISOString()} | ${req.method} ${req.originalUrl}`
    );
  }
  next();
});

/* ═══════════════════════════════════════════
   RATE LIMITER (per-IP, in-memory)
═══════════════════════════════════════════ */
const _limiter   = new Map();
const WINDOW_MS  = 60_000;
const MAX_REQ    = 120;
const UPLOAD_MAX = 20;

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of _limiter.entries()) {
    if (now - data.time > WINDOW_MS) _limiter.delete(ip);
  }
}, 5 * 60_000);

function rateLimiter(max = MAX_REQ) {
  return (req, res, next) => {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0].trim() ??
      req.socket.remoteAddress ??
      "unknown";

    const now = Date.now();
    const key = `${ip}:${max}`;
    let data  = _limiter.get(key);

    if (!data || now - data.time > WINDOW_MS) {
      data = { count: 1, time: now };
    } else {
      data.count++;
    }

    _limiter.set(key, data);

    if (data.count > max) {
      return res.status(429).json({
        success    : false,
        message    : "Too many requests. Please wait a moment.",
        retryAfter : Math.ceil((WINDOW_MS - (now - data.time)) / 1000),
      });
    }

    next();
  };
}

app.use(rateLimiter(MAX_REQ));

/* ═══════════════════════════════════════════
   CRON JOBS
═══════════════════════════════════════════ */
import "./jobs/expirePromotions.js";
import { startChatCleanupJob } from "./jobs/cleanupChats.js";
import { startCleanupJobs }    from "./jobs/cleanup.js";      // ← OTP + device cleanup

/* ═══════════════════════════════════════════
   ROUTE IMPORTS
═══════════════════════════════════════════ */
import addproductRouter    from "./routes/addproduct.js";
import userRouter          from "./routes/users.js";
import messagesRouter      from "./routes/messages.js";
import adminRouter         from "./routes/admin.js";
import searchRouter        from "./routes/search.js";
import conversationsRouter from "./routes/conversations.js";
import productDetailRouter from "./routes/productDetail.js";
import homepageRouter      from "./routes/homepage.js";
import sellerProfileRouter from "./routes/sellerprofile.js";
import dashboardRoutes     from "./routes/dashboard.js";
import notificationsRouter from "./routes/notifications.js";
import productsRouter from "./routes/products.js";
import walletRoutes        from "./routes/wallets.js";
import p2pRouter           from "./routes/p2p.js";
import verificationRouter  from "./routes/verification.js";   // ← NEW
import marketProductsRouter from "./routes/marketproducts.js";
import authRouter             from "./routes/sellerAuth.routes.js";
import sellerOnboardingRouter from "./routes/sellerOnboarding.routes.js";


/* ═══════════════════════════════════════════
   API ROUTES
═══════════════════════════════════════════ */
app.use("/api/payment",       paymentRouter);
app.use("/api/seller",        sellerProfileRouter);
app.use("/api/addproduct",    addproductRouter);
app.use("/api/users",         userRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/market-products", marketProductsRouter);
app.use("/api/auth",              authRouter);
app.use("/api/seller-onboarding", sellerOnboardingRouter);

app.use("/api/messages/upload", rateLimiter(UPLOAD_MAX));
app.use("/api/messages",        messagesRouter);

app.use("/api/admin",         adminRouter);
app.use("/api/search",        searchRouter);
app.use("/api/product",       productDetailRouter);
app.use("/api/homepage",      homepageRouter);
app.use("/api/dashboard",     dashboardRoutes);
app.use("/api/notifications", notificationsRouter);
app.use("/api/products", productsRouter);
app.use("/api/v1/wallets",    walletRoutes);
app.use("/api/p2p",           p2pRouter);
app.use("/api/verification",  verificationRouter);            // ← NEW
app.use("/api/market-products", marketProductsRouter);

/* ═══════════════════════════════════════════
   HEALTH CHECK
═══════════════════════════════════════════ */
app.get("/api/health", async (_req, res) => {
  try {
    const start       = Date.now();
    const { rows }    = await pool.query("SELECT 1 AS ok");
    const dbLatencyMs = Date.now() - start;

    return res.json({
      success       : true,
      status        : "healthy",
      database      : rows[0]?.ok === 1,
      db_latency_ms : dbLatencyMs,
      uptime_s      : Math.floor(process.uptime()),
      memory_mb     : Math.round(process.memoryUsage().rss / 1024 / 1024),
      online_users  : getOnlineCount(),
      node_version  : process.version,
      env           : process.env.NODE_ENV || "development",
    });
  } catch (err) {
    return res.status(500).json({
      success : false,
      status  : "unhealthy",
      error   : err.message,
    });
  }
});

/* ═══════════════════════════════════════════
   STATIC BUILD (production)
═══════════════════════════════════════════ */
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "dist");
  app.use(express.static(distPath, { maxAge: "1d" }));

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({
        success : false,
        message : `API route not found: ${req.method} ${req.originalUrl}`,
      });
    }
    res.sendFile(path.join(distPath, "index.html"));
  });
}

/* ═══════════════════════════════════════════
   404
═══════════════════════════════════════════ */
app.use((req, res) => {
  res.status(404).json({
    success : false,
    message : `Cannot ${req.method} ${req.originalUrl}`,
  });
});

/* ═══════════════════════════════════════════
   GLOBAL ERROR HANDLER
═══════════════════════════════════════════ */
app.use((err, req, res, _next) => {
  console.error("🔥 Unhandled error:", err.message || err);

  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(400).json({ success: false, message: "File too large (max 10 MB)" });
  if (err.code === "LIMIT_FILE_COUNT")
    return res.status(400).json({ success: false, message: "Too many files" });
  if (err.code === "LIMIT_UNEXPECTED_FILE")
    return res.status(400).json({ success: false, message: "Unexpected file field" });
  if (err.message === "Only image files are allowed")
    return res.status(400).json({ success: false, message: err.message });
  if (err.message?.startsWith("CORS blocked"))
    return res.status(403).json({ success: false, message: err.message });
  if (err.code === "23505")
    return res.status(409).json({ success: false, message: "Duplicate entry" });
  if (err.code === "23503")
    return res.status(400).json({ success: false, message: "Referenced record not found" });
  if (err.code === "23514")
    return res.status(400).json({ success: false, message: "Value violates database constraint" });

  const status  = err.status ?? err.statusCode ?? 500;
  const message =
    process.env.NODE_ENV === "production" && status === 500
      ? "Internal server error"
      : err.message ?? "Internal server error";

  res.status(status).json({ success: false, message });
});

/* ═══════════════════════════════════════════
   GRACEFUL SHUTDOWN
═══════════════════════════════════════════ */
async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully…`);

  server.close(async () => {
    console.log("HTTP server closed");
    try {
      await pool.end();
      console.log("Database pool drained");
    } catch (err) {
      console.error("Pool drain error:", err.message);
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forced exit after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

/* ═══════════════════════════════════════════
   START
═══════════════════════════════════════════ */
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`   ENV  : ${process.env.NODE_ENV || "development"}`);
  console.log(`   CORS : ${ALLOWED_ORIGIN}`);

  startChatCleanupJob();
  startCleanupJobs();                                          // ← OTP cleanup
  console.log("🧹 Chat + OTP cleanup jobs started");
});

export default app;