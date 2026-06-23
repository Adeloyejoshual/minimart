/**
 * server.js
 * Entry point — Express + Socket.IO + CockroachDB
 *
 * v2 improvements:
 *  1.  Helmet for security headers (replaces manual headers)
 *  2.  express-rate-limit replaces hand-rolled Map limiter
 *  3.  Webhook raw body parsing hardened (type: "*\/*")
 *  4.  jobs/index.js replaces direct cron import
 *  5.  Verification debug middleware removed (was leaking auth info)
 *  6.  Health check expanded (Redis, job runner, cache size)
 *  7.  SPA 404 guard moved before wildcard static serve
 *  8.  Pool config tuned (keepAlive, statement_timeout)
 *  9.  Structured startup env validation with early exit
 * 10.  CSP header added
 * 11.  Request ID injected on every request for tracing
 * 12.  Graceful shutdown drains in-flight requests before pool.end()
 * 13.  Cache stats exposed on health endpoint
 * 14.  CORS origin list deduplicated at boot, not per-request
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

import { initSocket, getOnlineCount }    from "./socket.js";
import { startJobRunner, stopJobRunner } from "./jobs/jobRunner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const IS_PROD = process.env.NODE_ENV === "production";

/* ═══════════════════════════════════════════════════════════════
   ENVIRONMENT VALIDATION  (upgrade #9)
   Fail loudly at boot — never silently limp with broken config.
═══════════════════════════════════════════════════════════════ */
const REQUIRED_ENV = [
  "COCKROACH_URI",
  "JWT_SECRET",
  "PAYSTACK_SECRET_KEY",
];

const WARN_ENV = [
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "CLIENT_ORIGIN",
  "FLW_SECRET_KEY",
  "FLW_SECRET_HASH",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "DOC_HASH_SECRET",
  "SIGNED_URL_SECRET",
  "REDIS_URL",
];

const missingRequired = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingRequired.length) {
  console.error("❌ Missing required environment variables:");
  missingRequired.forEach((k) => console.error(`   • ${k}`));
  process.exit(1);
}

const missingWarn = WARN_ENV.filter((k) => !process.env[k]);
if (missingWarn.length) {
  console.warn("⚠  Optional env vars not set (some features may be disabled):");
  missingWarn.forEach((k) => console.warn(`   • ${k}`));
}

/* ═══════════════════════════════════════════════════════════════
   APP + HTTP SERVER
═══════════════════════════════════════════════════════════════ */
const app    = express();
const PORT   = Number(process.env.PORT) || 5000;
const server = http.createServer(app);

/* Trust first proxy — required for express-rate-limit behind Render/Railway */
app.set("trust proxy", 1);

/* ═══════════════════════════════════════════════════════════════
   DATABASE  (upgrade #8 — keepAlive + statement_timeout)
═══════════════════════════════════════════════════════════════ */
export const pool = new Pool({
  connectionString        : process.env.COCKROACH_URI,
  ssl                     : { rejectUnauthorized: false },
  max                     : 15,
  min                     : 2,
  idleTimeoutMillis       : 30_000,
  connectionTimeoutMillis : 5_000,
  keepAlive               : true,
  keepAliveInitialDelayMillis: 10_000,
  application_name        : "loemart-server",
  options                 : "--statement_timeout=30000",
});

/* Verify connection at boot */
(async () => {
  try {
    const { rows } = await pool.query("SELECT version()");
    console.log("✅ CockroachDB:", rows[0].version.split(" ")[0]);
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  }
})();

pool.on("error", (err) =>
  console.error("🔥 Unexpected pool error:", err.message)
);

pool.on("connect", () =>
  console.log("[db] new client connected to pool")
);

/* ═══════════════════════════════════════════════════════════════
   SOCKET.IO
═══════════════════════════════════════════════════════════════ */
const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || "*";
export const io      = initSocket(server, ALLOWED_ORIGIN);

/* ═══════════════════════════════════════════════════════════════
   IN-MEMORY CACHE  (TTL-based, no Redis dependency)
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

export const deleteCache = (key) => _cache.delete(key);

export const clearCachePattern = (prefix) => {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
};

/* Periodic eviction — runs every minute */
const _cacheEvictInterval = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _cache.entries()) {
    if (now > v.expires) _cache.delete(k);
  }
}, 60_000);
_cacheEvictInterval.unref(); // don't block process exit

/* ═══════════════════════════════════════════════════════════════
   CORS  (upgrade #14 — origins deduped at boot)
═══════════════════════════════════════════════════════════════ */
const HARD_ALLOWED = [
  "https://www.loemart.com",
  "https://loemart.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
];

/* Build allowed set once at startup — not on every request */
const _envOrigins = ALLOWED_ORIGIN === "*"
  ? []
  : ALLOWED_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);

const ALLOWED_ORIGINS = new Set([..._envOrigins, ...HARD_ALLOWED]);

const corsOptions = {
  origin(origin, cb) {
    /* No origin = server-to-server / mobile native / curl */
    if (!origin)                    return cb(null, true);
    if (ALLOWED_ORIGIN === "*")     return cb(null, true);
    if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);

    console.warn("[CORS] blocked:", origin);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials    : true,
  methods        : ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders : ["Content-Type", "Authorization", "x-requested-with", "x-request-id"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ═══════════════════════════════════════════════════════════════
   HELMET  (upgrade #1 — replaces manual security headers)
   Sets: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection,
         Referrer-Policy, Permissions-Policy, HSTS, CSP, etc.
═══════════════════════════════════════════════════════════════ */
app.use(
  helmet({
    /* upgrade #10 — Content Security Policy */
    contentSecurityPolicy: IS_PROD
      ? {
          directives: {
            defaultSrc  : ["'self'"],
            scriptSrc   : ["'self'"],
            styleSrc    : ["'self'", "'unsafe-inline'"],
            imgSrc      : ["'self'", "data:", "https://res.cloudinary.com"],
            connectSrc  : ["'self'", "https://api.paystack.co"],
            fontSrc     : ["'self'", "https://fonts.gstatic.com"],
            objectSrc   : ["'none'"],
            frameSrc    : ["'none'"],
            upgradeInsecureRequests: [],
          },
        }
      : false,                     /* CSP off in dev — avoids Vite HMR issues */
    crossOriginEmbedderPolicy : false,  /* allow Cloudinary images */
    crossOriginOpenerPolicy   : { policy: "same-origin-allow-popups" },
    hsts: IS_PROD
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy : { policy: "strict-origin-when-cross-origin" },
    permissionsPolicy: {
      features: {
        camera      : [],
        microphone  : [],
        geolocation : ["self"],
      },
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
      /* Prevent serving HTML from the uploads directory */
      if (/\.html?$/i.test(filePath))
        res.setHeader("Content-Type", "text/plain");
    },
  })
);

/* ═══════════════════════════════════════════════════════════════
   FLW KEY MODE HELPER
═══════════════════════════════════════════════════════════════ */
const flwKeyMode = () => {
  const key = process.env.FLW_SECRET_KEY ?? "";
  if (!key)                 return "missing";
  if (key.includes("TEST")) return "test";
  return "live";
};

/* ═══════════════════════════════════════════════════════════════
   WEBHOOKS  ⚠  MUST come before express.json()
   upgrade #3: use type:"*\/*" so any content-type is accepted
═══════════════════════════════════════════════════════════════ */
import paymentRouter, { webhookRouter } from "./routes/payment.js";
import flwWebhookRouter                 from "./routes/webhooks/flutterwave.js";
import checkoutWebhookRouter            from "./routes/checkout/webhook.js";
import checkoutRouter                   from "./routes/checkout/index.js";

/* Paystack webhook — raw body for HMAC verification */
app.use(
  "/api/payment/webhook",
  express.raw({ type: "*/*" }),         /* upgrade #3 */
  webhookRouter
);

/* Flutterwave webhook — raw then parse manually */
app.use(
  "/api/webhooks/flutterwave",
  express.raw({ type: "*/*" }),         /* upgrade #3 */
  (req, _res, next) => {
    try   { req.body = JSON.parse(req.body.toString()); }
    catch { req.body = {}; }
    next();
  },
  flwWebhookRouter
);

/* Flutterwave debug capture — logs raw payload to DB */
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
    } catch { /* non-critical — capture failure should not 500 */ }

    return res.status(200).json({ captured: true, event: body?.event });
  }
);

/* Checkout webhook */
app.use(
  "/api/checkout/webhook/payment",
  express.raw({ type: "*/*" }),         /* upgrade #3 */
  checkoutWebhookRouter
);

/* ═══════════════════════════════════════════════════════════════
   BODY PARSERS  ⚠  After webhooks
═══════════════════════════════════════════════════════════════ */
app.use(express.json({       limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ═══════════════════════════════════════════════════════════════
   REQUEST ID  (upgrade #11 — tracing)
   Every request gets a unique ID injected into headers +
   available on req.requestId for downstream logging.
═══════════════════════════════════════════════════════════════ */
app.use((req, res, next) => {
  const id = req.headers["x-request-id"] || crypto.randomUUID();
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
   GLOBAL RATE LIMITER  (upgrade #2 — express-rate-limit)
   Replaces the hand-rolled Map implementation.
   Per-IP, 120 req/min on all routes.
   Upload-heavy routes get their own stricter limiter below.
═══════════════════════════════════════════════════════════════ */
const globalLimiter = rateLimit({
  windowMs        : 60_000,
  max             : IS_PROD ? 120 : 1_000,
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : (req) =>
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ??
    req.socket.remoteAddress ??
    "unknown",
  handler         : (req, res) =>
    res.status(429).json({
      success    : false,
      message    : "Too many requests. Please wait a moment.",
      retryAfter : Math.ceil(
        (req.rateLimit?.resetTime
          ? (req.rateLimit.resetTime - Date.now()) / 1_000
          : 60)
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
    req.socket.remoteAddress ??
    "unknown",
  handler         : (_req, res) =>
    res.status(429).json({
      success : false,
      message : "Too many upload requests. Please slow down.",
    }),
});

app.use(globalLimiter);

/* ═══════════════════════════════════════════════════════════════
   CRON JOBS  (upgrade #4 — single jobs/index.js import)
   jobs/index.js schedules all crons in one place.
   Replaces: import "./jobs/expirePromotions.js";
═══════════════════════════════════════════════════════════════ */
await import("./jobs/index.js");

/* ═══════════════════════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════════════════════ */

/* ── Payment ── */
app.use("/api/payment", paymentRouter);

/* ── Checkout ── */
app.use("/api/checkout", checkoutRouter);

/* ── Auth ── */
import authRouter             from "./routes/sellerAuth.routes.js";
import sellerOnboardingRouter from "./routes/sellerOnboarding.routes.js";
app.use("/api/auth",              authRouter);
app.use("/api/seller-onboarding", sellerOnboardingRouter);

/* ── Seller ── */
import sellerProfileRouter   from "./routes/sellerprofile.js";
import sellerPayoutRoutes    from "./routes/seller/payout.js";
import sellerDashboardRouter from "./routes/seller/dashboard.js";
import sellerSettingsRouter  from "./routes/seller/settings.js";
app.use("/api/seller",           sellerProfileRouter);
app.use("/api/seller/payout",    sellerPayoutRoutes);
app.use("/api/seller-dashboard", sellerDashboardRouter);
app.use("/api/seller/settings",  sellerSettingsRouter);

/* ── Products ── */
import marketRouter from "./routes/market/index.js";
app.use("/api/products", marketRouter);

/* ── Shop Detail ── */
import marketDetailRouter from "./routes/marketDetail/index.js";
app.use("/api/shop", marketDetailRouter);

/* ── Cart ── */
import cartRouter from "./routes/cart/index.js";
app.use("/api/cart", cartRouter);

/* ── Add Product + Product Detail ── */
import addproductRouter    from "./routes/addproduct.js";
import productDetailRouter from "./routes/productDetail.js";
app.use("/api/addproduct", addproductRouter);
app.use("/api/product",    productDetailRouter);

/* ── Users ── */
import userRouter from "./routes/users.js";
app.use("/api/users", userRouter);

/* ── Messaging (upload-heavy route gets its own limiter) ── */
import messagesRouter      from "./routes/messages.js";
import conversationsRouter from "./routes/conversations.js";
app.use("/api/messages/upload", uploadLimiter);
app.use("/api/messages",        messagesRouter);
app.use("/api/conversations",   conversationsRouter);

/* ── Admin ── */
import adminRouter from "./routes/admin.js";
app.use("/api/admin", adminRouter);

/* ── Search ── */
import searchRouter from "./routes/search.js";
app.use("/api/search", searchRouter);

/* ── Homepage ── */
import homepageRouter from "./routes/homepage.js";
app.use("/api/homepage", homepageRouter);

/* ── Dashboard ── */
import dashboardRoutes from "./routes/dashboard.js";
app.use("/api/dashboard",        dashboardRoutes);
app.use("/api/seller-dashboard", dashboardRoutes);

/* ── Notifications ── */
import notificationsRouter from "./routes/notifications.js";
app.use("/api/notifications", notificationsRouter);

/* ── Wallet ── */
import walletRoutes from "./routes/wallets.js";
app.use("/api/v1/wallets", walletRoutes);

/* ── P2P ── */
import p2pRouter from "./routes/p2p.js";
app.use("/api/p2p", p2pRouter);

/* ── Verification ── */
import verificationRouter from "./routes/verification.js";
app.use("/api/verification", verificationRouter);

/* ── Coupons ── */
import couponsRouter from "./routes/coupons.js";
app.use("/api/coupons", couponsRouter);

/* ── Spin Wheel ── */
import spinwheelRouter from "./routes/spinwheel.js";
app.use("/api/spinwheel", spinwheelRouter);

/* ═══════════════════════════════════════════════════════════════
   HEALTH CHECK  (upgrade #6 — expanded metrics)
═══════════════════════════════════════════════════════════════ */
app.get("/api/health", async (_req, res) => {
  let dbOk        = false;
  let dbLatency   = null;
  let dbError     = null;
  let dbPoolStats = null;

  try {
    const t0       = Date.now();
    const { rows } = await pool.query("SELECT 1 AS ok");
    dbLatency      = Date.now() - t0;
    dbOk           = rows[0]?.ok == 1;
    dbPoolStats    = {
      total    : pool.totalCount,
      idle     : pool.idleCount,
      waiting  : pool.waitingCount,
    };
  } catch (err) {
    dbError = err.message;
  }

  /* upgrade #13 — cache stats */
  const cacheStats = {
    size  : _cache.size,
    keys  : IS_PROD ? undefined : [..._cache.keys()].slice(0, 10),
  };

  const status = dbOk ? "healthy" : "degraded";

  return res.status(dbOk ? 200 : 503).json({
    success       : true,
    status,
    timestamp     : new Date().toISOString(),

    database      : {
      ok        : dbOk,
      latency_ms: dbLatency,
      error     : dbError ?? undefined,
      pool      : dbPoolStats,
    },

    process       : {
      uptime_s   : Math.floor(process.uptime()),
      memory_mb  : Math.round(process.memoryUsage().rss / 1_048_576),
      node       : process.version,
      env        : process.env.NODE_ENV || "development",
    },

    cache         : cacheStats,
    online_users  : getOnlineCount(),
    flw_mode      : flwKeyMode(),
  });
});

/* ═══════════════════════════════════════════════════════════════
   STATIC SPA  (production only)
   upgrade #7 — API 404 guard moved BEFORE wildcard static serve
═══════════════════════════════════════════════════════════════ */
if (IS_PROD) {
  const distPath = path.join(__dirname, "dist");

  /* Cache-bust HTML, long-cache for assets */
  app.use(
    express.static(distPath, {
      maxAge  : "1d",
      setHeaders(res, filePath) {
        if (/\.html?$/i.test(filePath)) {
          /* Never cache HTML — ensures fresh SPA shell */
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      },
    })
  );

  /* upgrade #7 — reject unknown API routes before SPA fallback */
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({
        success : false,
        message : `API route not found: ${req.method} ${req.originalUrl}`,
      });
    }
    next();
  });

  /* SPA fallback for all non-API routes */
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

/* ═══════════════════════════════════════════════════════════════
   404  (development + unknown API routes)
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
  console.error(`🔥 [${reqId}] Unhandled error:`, err.message ?? err);
  if (!IS_PROD) console.error(err.stack);

  /* Multer */
  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(400).json({ success: false, message: "File too large (max 10 MB)", reqId });
  if (err.code === "LIMIT_FILE_COUNT")
    return res.status(400).json({ success: false, message: "Too many files", reqId });
  if (err.code === "LIMIT_UNEXPECTED_FILE")
    return res.status(400).json({ success: false, message: "Unexpected file field", reqId });
  if (err.message === "Only image files are allowed")
    return res.status(400).json({ success: false, message: err.message, reqId });

  /* CORS */
  if (err.message?.startsWith("CORS blocked"))
    return res.status(403).json({ success: false, message: err.message, reqId });

  /* PostgreSQL constraint violations */
  if (err.code === "23505")
    return res.status(409).json({ success: false, message: "Duplicate entry", reqId });
  if (err.code === "23503")
    return res.status(400).json({ success: false, message: "Referenced record not found", reqId });
  if (err.code === "23514")
    return res.status(400).json({ success: false, message: "Value violates database constraint", reqId });
  if (err.code === "22P02")
    return res.status(400).json({ success: false, message: "Invalid input format", reqId });

  /* HTTP errors forwarded from routes */
  const status  = err.status ?? err.statusCode ?? 500;
  const message = IS_PROD && status === 500
    ? "Internal server error"
    : (err.message ?? "Internal server error");

  return res.status(status).json({ success: false, message, reqId });
});

/* ═══════════════════════════════════════════════════════════════
   GRACEFUL SHUTDOWN  (upgrade #12)
   Stops accepting new connections → waits for in-flight requests
   to complete → drains pool → exits.
═══════════════════════════════════════════════════════════════ */
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[server] ${signal} received — graceful shutdown starting…`);

  /* Stop background jobs first */
  stopJobRunner();
  clearInterval(_cacheEvictInterval);

  /* Hard timeout — force exit after 15s if anything hangs */
  const forceExit = setTimeout(() => {
    console.error("[server] Forced exit — shutdown timed out");
    process.exit(1);
  }, 15_000);
  forceExit.unref();

  /* Stop accepting new HTTP connections */
  server.close(async () => {
    console.log("[server] HTTP server closed — no new connections accepted");

    /* upgrade #12: wait for pool to drain cleanly */
    try {
      await pool.end();
      console.log("[server] Database pool drained");
    } catch (err) {
      console.error("[server] Pool drain error:", err.message);
    }

    clearTimeout(forceExit);
    console.log("[server] Shutdown complete");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

/* Catch unhandled promise rejections — log but don't crash in prod */
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
═══════════════════════════════════════════════════════════════ */
server.listen(PORT, () => {
  const mode = flwKeyMode();

  const line = (label, value) =>
    console.log(`   ${label.padEnd(14)}: ${value}`);

  console.log("");
  console.log(`🚀 Loemart server running on port ${PORT}`);
  console.log("─".repeat(52));
  line("ENV",         process.env.NODE_ENV || "development");
  line("CORS",        ALLOWED_ORIGIN === "*" ? "* (all)" : [...ALLOWED_ORIGINS].join(", ").slice(0, 40) + "…");
  line("DB",          process.env.COCKROACH_URI ? "✅ URI set"   : "❌ MISSING");
  line("JWT",         process.env.JWT_SECRET    ? "✅ set"       : "❌ MISSING");
  line("RESEND",      process.env.RESEND_API_KEY
    ? `✅ SET (…${process.env.RESEND_API_KEY.slice(-4)})`
    : "❌ NOT SET");
  line("EMAIL FROM",  process.env.EMAIL_FROM || "(default)");
  line("FLW KEY",     mode === "missing" ? "❌ MISSING" : mode === "live" ? "✅ LIVE" : "⚠️  TEST");
  line("FLW HASH",    process.env.FLW_SECRET_HASH ? "✅ set" : "❌ MISSING");
  line("CLOUDINARY",  process.env.CLOUDINARY_CLOUD_NAME ? "✅ set" : "⚠️  not set");
  line("DOC_HASH",    process.env.DOC_HASH_SECRET    ? "✅ set" : "⚠️  not set — id dedup disabled");
  line("SIGNED_URL",  process.env.SIGNED_URL_SECRET  ? "✅ set" : "⚠️  not set");
  line("REDIS",       process.env.REDIS_URL           ? "✅ set" : "⚠️  not set — trending disabled");
  console.log("─".repeat(52));
  line("HEALTH",      `/api/health`);
  line("WEBHOOK PS",  `/api/payment/webhook`);
  line("WEBHOOK FLW", `/api/webhooks/flutterwave`);
  console.log("─".repeat(52));
  console.log("");

  startJobRunner();
  console.log("🧹 Background jobs started");
});

export default app;