/**
 * server.js
 * Entry point — Express + Socket.IO + CockroachDB
 */

import express           from "express";
import cors              from "cors";
import helmet            from "helmet";
import rateLimit         from "express-rate-limit";
import path              from "path";
import http              from "http";
import crypto            from "crypto";
import dotenv            from "dotenv";
import { fileURLToPath } from "url";
import { Pool }          from "pg";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const IS_PROD    = process.env.NODE_ENV === "production";

/* ═══════════════════════════════════════════════════════════════
   ENVIRONMENT VALIDATION
═══════════════════════════════════════════════════════════════ */
const REQUIRED_ENV = ["COCKROACH_URI", "JWT_SECRET", "PAYSTACK_SECRET_KEY"];
const WARN_ENV     = [
  "RESEND_API_KEY", "EMAIL_FROM", "CLIENT_ORIGIN",
  "FLW_SECRET_KEY", "FLW_SECRET_HASH",
  "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET",
  "DOC_HASH_SECRET", "SIGNED_URL_SECRET", "REDIS_URL",
];

const missingRequired = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingRequired.length) {
  console.error("❌ Missing required environment variables:");
  missingRequired.forEach((k) => console.error(`   • ${k}`));
  process.exit(1);
}

const missingWarn = WARN_ENV.filter((k) => !process.env[k]);
if (missingWarn.length) {
  console.warn("⚠  Optional env vars not set:");
  missingWarn.forEach((k) => console.warn(`   • ${k}`));
}

/* ═══════════════════════════════════════════════════════════════
   DATABASE
   Exported so routes can: import { pool } from "../server.js"
═══════════════════════════════════════════════════════════════ */
export const pool = new Pool({
  connectionString            : process.env.COCKROACH_URI,
  ssl                         : { rejectUnauthorized: false },
  max                         : 15,
  min                         : 2,
  idleTimeoutMillis           : 30_000,
  connectionTimeoutMillis     : 5_000,
  keepAlive                   : true,
  keepAliveInitialDelayMillis : 10_000,
  application_name            : "loemart-server",
});

pool.on("error",   (err) => console.error("🔥 Pool error:", err.message));
pool.on("connect", ()    => console.log("[db] client connected to pool"));

/* ═══════════════════════════════════════════════════════════════
   APP + HTTP SERVER
═══════════════════════════════════════════════════════════════ */
const app    = express();
const PORT   = Number(process.env.PORT) || 5000;
const server = http.createServer(app);

app.set("trust proxy", 1);

/* ═══════════════════════════════════════════════════════════════
   SOCKET.IO
═══════════════════════════════════════════════════════════════ */
import { initSocket, getOnlineCount } from "./socket.js";

const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || "*";
export const io      = initSocket(server, ALLOWED_ORIGIN);

/* ═══════════════════════════════════════════════════════════════
   IN-MEMORY CACHE
═══════════════════════════════════════════════════════════════ */
const _cache    = new Map();
const CACHE_TTL = 60_000;

export const setCache = (key, value, ttl = CACHE_TTL) =>
  _cache.set(key, { value, expires: Date.now() + ttl });

export const getCache = (key) => {
  const item = _cache.get(key);
  if (!item)                     return null;
  if (Date.now() > item.expires) { _cache.delete(key); return null; }
  return item.value;
};

export const deleteCache       = (key)    => _cache.delete(key);
export const clearCachePattern = (prefix) => {
  for (const key of _cache.keys())
    if (key.startsWith(prefix)) _cache.delete(key);
};

const _cacheEvictInterval = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _cache.entries())
    if (now > v.expires) _cache.delete(k);
}, 60_000);
_cacheEvictInterval.unref();

/* ═══════════════════════════════════════════════════════════════
   CORS
═══════════════════════════════════════════════════════════════ */
const HARD_ALLOWED = [
  "https://www.loemart.com",
  "https://loemart.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
];

const _envOrigins = ALLOWED_ORIGIN === "*"
  ? []
  : ALLOWED_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);

const ALLOWED_ORIGINS = new Set([..._envOrigins, ...HARD_ALLOWED]);

const corsOptions = {
  origin(origin, cb) {
    if (!origin)                     return cb(null, true);
    if (ALLOWED_ORIGIN === "*")      return cb(null, true);
    if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    console.warn("[CORS] blocked:", origin);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials    : true,
  methods        : ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders : [
    "Content-Type", "Authorization",
    "x-requested-with", "x-request-id",
  ],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ═══════════════════════════════════════════════════════════════
   HELMET
═══════════════════════════════════════════════════════════════ */
app.use(
  helmet({
    contentSecurityPolicy: IS_PROD
      ? {
          directives: {
            defaultSrc : ["'self'"],
            scriptSrc  : ["'self'"],
            styleSrc   : ["'self'", "'unsafe-inline'"],
            imgSrc     : ["'self'", "data:", "https://res.cloudinary.com"],
            connectSrc : ["'self'", "https://api.paystack.co"],
            fontSrc    : ["'self'", "https://fonts.gstatic.com"],
            objectSrc  : ["'none'"],
            frameSrc   : ["'none'"],
            upgradeInsecureRequests: [],
          },
        }
      : false,
    crossOriginEmbedderPolicy : false,
    crossOriginOpenerPolicy   : { policy: "same-origin-allow-popups" },
    hsts: IS_PROD
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy    : { policy: "strict-origin-when-cross-origin" },
    permissionsPolicy : {
      features: { camera: [], microphone: [], geolocation: ["self"] },
    },
  })
);

/* ═══════════════════════════════════════════════════════════════
   STATIC — /uploads
═══════════════════════════════════════════════════════════════ */
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge      : "7d",
    etag        : true,
    lastModified: true,
    setHeaders(res, filePath) {
      if (/\.html?$/i.test(filePath))
        res.setHeader("Content-Type", "text/plain");
    },
  })
);

/* ═══════════════════════════════════════════════════════════════
   HELPER
═══════════════════════════════════════════════════════════════ */
const flwKeyMode = () => {
  const key = process.env.FLW_SECRET_KEY ?? "";
  if (!key)                 return "missing";
  if (key.includes("TEST")) return "test";
  return "live";
};

/* ═══════════════════════════════════════════════════════════════
   STATIC ROUTE IMPORTS
   ─ All imports are static (no top-level await import())
   ─ This guarantees server.listen() is always reached
   ─ cleanupStuckPendingPayments comes from payment.js
   ─ pauseExpiredListings comes from addproduct.js
   ─ Both are passed to startJobs() — never imported by jobs/index.js
═══════════════════════════════════════════════════════════════ */

/* Payment */
import paymentRouter, {
  webhookRouter,
  cleanupStuckPendingPayments,
} from "./routes/payment.js";

/* Webhooks */
import flwWebhookRouter      from "./routes/webhooks/flutterwave.js";
import checkoutWebhookRouter from "./routes/checkout/webhook.js";
import checkoutRouter        from "./routes/checkout/index.js";

/* Auth */
import authRouter             from "./routes/sellerAuth.routes.js";
import sellerOnboardingRouter from "./routes/sellerOnboarding.routes.js";

/* Seller */
import sellerProfileRouter   from "./routes/sellerprofile.js";
import sellerPayoutRoutes    from "./routes/seller/payout.js";
import sellerDashboardRouter from "./routes/seller/dashboard.js";
import sellerSettingsRouter  from "./routes/seller/settings.js";

/* Products */
import addproductRouter, {
  pauseExpiredListings,
} from "./routes/addproduct.js";

import marketRouter        from "./routes/market/index.js";
import marketDetailRouter  from "./routes/marketDetail/index.js";
import productDetailRouter from "./routes/productDetail.js";
import cartRouter          from "./routes/cart/index.js";

/* Users + messaging */
import userRouter          from "./routes/users.js";
import messagesRouter      from "./routes/messages.js";
import conversationsRouter from "./routes/conversations.js";

/* Platform */
import adminRouter         from "./routes/admin.js";
import searchRouter        from "./routes/search.js";
import homepageRouter      from "./routes/homepage.js";
import dashboardRoutes     from "./routes/dashboard.js";
import notificationsRouter from "./routes/notifications.js";
import walletRoutes        from "./routes/wallets.js";
import p2pRouter           from "./routes/p2p.js";
import verificationRouter  from "./routes/verification.js";
import couponsRouter       from "./routes/coupons.js";
import spinwheelRouter     from "./routes/spinwheel.js";

/* Jobs — only the startJobs function, no route imports inside */
import { startJobs } from "./jobs/index.js";

/* ═══════════════════════════════════════════════════════════════
   WEBHOOKS  ⚠  Before body parsers
═══════════════════════════════════════════════════════════════ */

app.use(
  "/api/payment/webhook",
  express.raw({ type: "*/*" }),
  webhookRouter
);

app.use(
  "/api/webhooks/flutterwave",
  express.raw({ type: "*/*" }),
  (req, _res, next) => {
    try   { req.body = JSON.parse(req.body.toString()); }
    catch { req.body = {}; }
    next();
  },
  flwWebhookRouter
);

app.post(
  "/api/webhooks/flw-capture",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    const raw  = req.body?.toString?.() ?? "";
    const body = (() => {
      try { return JSON.parse(raw); } catch { return { raw }; }
    })();

    console.log("═".repeat(52));
    console.log("  FLW CAPTURE —", new Date().toISOString());
    console.log("  verif-hash  :", req.headers["verif-hash"]);
    console.log("  event       :", body?.event);
    console.log("  status      :", body?.data?.status);
    console.log("═".repeat(52));

    try {
      await pool.query(
        `INSERT INTO market.webhook_logs
           (source, event, payload, headers, created_at)
         VALUES ('flw_capture', $1, $2, $3, NOW())`,
        [
          body?.event ?? "unknown",
          JSON.stringify(body),
          JSON.stringify(req.headers),
        ]
      );
    } catch { /* non-critical */ }

    return res.status(200).json({ captured: true, event: body?.event });
  }
);

app.use(
  "/api/checkout/webhook/payment",
  express.raw({ type: "*/*" }),
  checkoutWebhookRouter
);

/* ═══════════════════════════════════════════════════════════════
   BODY PARSERS  ⚠  After webhooks
═══════════════════════════════════════════════════════════════ */
app.use(express.json({       limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ═══════════════════════════════════════════════════════════════
   REQUEST ID
═══════════════════════════════════════════════════════════════ */
app.use((req, res, next) => {
  const id      = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
});

/* ═══════════════════════════════════════════════════════════════
   REQUEST LOGGER
═══════════════════════════════════════════════════════════════ */
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== "test") {
    console.log(
      `${new Date().toISOString()} | ${req.method} ${req.originalUrl}` +
      ` | reqId=${req.requestId}`
    );
  }
  next();
});

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITERS
═══════════════════════════════════════════════════════════════ */
const globalLimiter = rateLimit({
  windowMs        : 60_000,
  max             : IS_PROD ? 120 : 1_000,
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : (req) =>
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ??
    req.socket.remoteAddress ?? "unknown",
  handler: (req, res) =>
    res.status(429).json({
      success    : false,
      message    : "Too many requests. Please wait a moment.",
      retryAfter : Math.ceil(
        req.rateLimit?.resetTime
          ? (req.rateLimit.resetTime - Date.now()) / 1_000
          : 60
      ),
    }),
});

const uploadLimiter = rateLimit({
  windowMs        : 60_000,
  max             : IS_PROD ? 20 : 200,
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : (req) =>
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ??
    req.socket.remoteAddress ?? "unknown",
  handler: (_req, res) =>
    res.status(429).json({
      success : false,
      message : "Too many upload requests. Please slow down.",
    }),
});

app.use(globalLimiter);

/* ═══════════════════════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════════════════════ */

app.use("/api/payment",          paymentRouter);
app.use("/api/checkout",         checkoutRouter);
app.use("/api/auth",             authRouter);
app.use("/api/seller-onboarding", sellerOnboardingRouter);
app.use("/api/seller",           sellerProfileRouter);
app.use("/api/seller/payout",    sellerPayoutRoutes);
app.use("/api/seller-dashboard", sellerDashboardRouter);
app.use("/api/seller/settings",  sellerSettingsRouter);
app.use("/api/products",         marketRouter);
app.use("/api/shop",             marketDetailRouter);
app.use("/api/cart",             cartRouter);
app.use("/api/addproduct",       addproductRouter);
app.use("/api/product",          productDetailRouter);
app.use("/api/users",            userRouter);
app.use("/api/messages/upload",  uploadLimiter);
app.use("/api/messages",         messagesRouter);
app.use("/api/conversations",    conversationsRouter);
app.use("/api/admin",            adminRouter);
app.use("/api/search",           searchRouter);
app.use("/api/homepage",         homepageRouter);
app.use("/api/dashboard",        dashboardRoutes);
app.use("/api/seller-dashboard", dashboardRoutes);
app.use("/api/notifications",    notificationsRouter);
app.use("/api/v1/wallets",       walletRoutes);
app.use("/api/p2p",              p2pRouter);
app.use("/api/verification",     verificationRouter);
app.use("/api/coupons",          couponsRouter);
app.use("/api/spinwheel",        spinwheelRouter);

/* ═══════════════════════════════════════════════════════════════
   HEALTH CHECK
═══════════════════════════════════════════════════════════════ */
app.get("/api/health", async (_req, res) => {
  let dbOk      = false;
  let dbLatency = null;
  let dbError   = null;
  let dbPool    = null;

  try {
    const t0       = Date.now();
    const { rows } = await pool.query("SELECT 1 AS ok");
    dbLatency      = Date.now() - t0;
    dbOk           = rows[0]?.ok == 1;
    dbPool         = {
      total   : pool.totalCount,
      idle    : pool.idleCount,
      waiting : pool.waitingCount,
    };
  } catch (err) {
    dbError = err.message;
  }

  return res.status(dbOk ? 200 : 503).json({
    success   : true,
    status    : dbOk ? "healthy" : "degraded",
    timestamp : new Date().toISOString(),
    database  : {
      ok         : dbOk,
      latency_ms : dbLatency,
      error      : dbError ?? undefined,
      pool       : dbPool,
    },
    process: {
      uptime_s  : Math.floor(process.uptime()),
      memory_mb : Math.round(process.memoryUsage().rss / 1_048_576),
      node      : process.version,
      env       : process.env.NODE_ENV || "development",
    },
    cache        : { size: _cache.size },
    online_users : getOnlineCount(),
    flw_mode     : flwKeyMode(),
  });
});

/* ═══════════════════════════════════════════════════════════════
   STATIC SPA  (production only)
═══════════════════════════════════════════════════════════════ */
if (IS_PROD) {
  const distPath = path.join(__dirname, "dist");

  app.use(
    express.static(distPath, {
      maxAge     : "1d",
      setHeaders(res, filePath) {
        if (/\.html?$/i.test(filePath))
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      },
    })
  );

  app.use((req, res, next) => {
    if (req.path.startsWith("/api/"))
      return res.status(404).json({
        success : false,
        message : `API route not found: ${req.method} ${req.originalUrl}`,
      });
    next();
  });

  app.get("*", (_req, res) =>
    res.sendFile(path.join(distPath, "index.html"))
  );
}

/* ═══════════════════════════════════════════════════════════════
   404
═══════════════════════════════════════════════════════════════ */
app.use((req, res) =>
  res.status(404).json({
    success : false,
    message : `Cannot ${req.method} ${req.originalUrl}`,
    reqId   : req.requestId,
  })
);

/* ═══════════════════════════════════════════════════════════════
   GLOBAL ERROR HANDLER
═══════════════════════════════════════════════════════════════ */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const reqId = req.requestId ?? "unknown";
  console.error(`🔥 [${reqId}]`, err.message ?? err);
  if (!IS_PROD) console.error(err.stack);

  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(400).json({ success: false, message: "File too large (max 10 MB)", reqId });
  if (err.code === "LIMIT_FILE_COUNT")
    return res.status(400).json({ success: false, message: "Too many files", reqId });
  if (err.code === "LIMIT_UNEXPECTED_FILE")
    return res.status(400).json({ success: false, message: "Unexpected file field", reqId });
  if (err.message === "Only image files are allowed")
    return res.status(400).json({ success: false, message: err.message, reqId });
  if (err.message?.startsWith("CORS blocked"))
    return res.status(403).json({ success: false, message: err.message, reqId });
  if (err.code === "23505")
    return res.status(409).json({ success: false, message: "Duplicate entry", reqId });
  if (err.code === "23503")
    return res.status(400).json({ success: false, message: "Referenced record not found", reqId });
  if (err.code === "23514")
    return res.status(400).json({ success: false, message: "Value violates database constraint", reqId });
  if (err.code === "22P02")
    return res.status(400).json({ success: false, message: "Invalid input format", reqId });

  const status  = err.status ?? err.statusCode ?? 500;
  const message = IS_PROD && status === 500
    ? "Internal server error"
    : (err.message ?? "Internal server error");

  return res.status(status).json({ success: false, message, reqId });
});

/* ═══════════════════════════════════════════════════════════════
   GRACEFUL SHUTDOWN
═══════════════════════════════════════════════════════════════ */
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[server] ${signal} — shutting down…`);
  clearInterval(_cacheEvictInterval);

  const forceExit = setTimeout(() => {
    console.error("[server] Forced exit after timeout");
    process.exit(1);
  }, 15_000);
  forceExit.unref();

  server.close(async () => {
    console.log("[server] HTTP server closed");
    try {
      await pool.end();
      console.log("[server] Pool drained");
    } catch (err) {
      console.error("[server] Pool drain error:", err.message);
    }
    clearTimeout(forceExit);
    process.exit(0);
  });
}

process.on("SIGTERM",            () => shutdown("SIGTERM"));
process.on("SIGINT",             () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled rejection:", reason);
  if (!IS_PROD) process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("[server] Uncaught exception:", err.message, err.stack);
  shutdown("uncaughtException");
});

/* ═══════════════════════════════════════════════════════════════
   START
   Step 1 — Verify DB
   Step 2 — Bind port
   Step 3 — Start jobs INSIDE listen callback
             (all modules guaranteed loaded at this point)
═══════════════════════════════════════════════════════════════ */
try {
  const { rows } = await pool.query("SELECT version()");
  console.log("✅ CockroachDB:", rows[0].version.split(" ")[0]);
} catch (err) {
  console.error("❌ Database connection failed:", err.message);
  process.exit(1);
}

server.listen(PORT, () => {
  const mode = flwKeyMode();
  const line = (label, value) =>
    console.log(`   ${label.padEnd(14)}: ${value}`);

  console.log("");
  console.log(`🚀 Loemart server on port ${PORT}`);
  console.log("─".repeat(52));
  line("ENV",        process.env.NODE_ENV || "development");
  line("DB",         "✅ connected");
  line("JWT",        process.env.JWT_SECRET            ? "✅ set"    : "❌ MISSING");
  line("RESEND",     process.env.RESEND_API_KEY
    ? `✅ (…${process.env.RESEND_API_KEY.slice(-4)})`
    : "❌ NOT SET");
  line("FLW KEY",    mode === "missing" ? "❌ MISSING" : mode === "live" ? "✅ LIVE" : "⚠️  TEST");
  line("FLW HASH",   process.env.FLW_SECRET_HASH       ? "✅ set"    : "❌ MISSING");
  line("CLOUDINARY", process.env.CLOUDINARY_CLOUD_NAME ? "✅ set"    : "⚠️  not set");
  line("DOC_HASH",   process.env.DOC_HASH_SECRET       ? "✅ set"    : "⚠️  not set");
  line("REDIS",      process.env.REDIS_URL              ? "✅ set"    : "⚠️  not set");
  console.log("─".repeat(52));
  console.log("");

  /* Start cron jobs — pass route exports to avoid circular imports */
  try {
    startJobs({
      pauseExpired : pauseExpiredListings,
      cleanupStuck : cleanupStuckPendingPayments,
    });
    console.log("🧹 Background jobs started");
  } catch (err) {
    console.error("[server] Jobs failed to start (non-fatal):", err.message);
  }
});

export default app;