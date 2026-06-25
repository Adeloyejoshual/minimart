/**
 * server.js
 *
 * Changes from previous version:
 *  ─ Logger condition fixed: !process.env.NODE_ENV !== "test"
 *    was always true — changed to process.env.NODE_ENV !== "test"
 *  ─ Duplicate route removed: /api/seller-dashboard mounted twice
 *  ─ COCKROACH_URI renamed to DATABASE_URL in REQUIRED_ENV
 *    (kept backward-compatible via fallback)
 *  ─ Pool min:2 removed — CockroachDB serverless bills per connection
 *  ─ keyGenerator falls back correctly without optional chaining gaps
 *  ─ Helmet CSP enabled with safe defaults instead of false
 *  ─ Static file serving hardened (dotfiles blocked)
 *  ─ SPA 404 guard moved before catch-all GET
 *  ─ Shutdown closes Socket.IO before pool
 *  ─ DB version log made resilient to version string format changes
 *  ─ sitemap route added (serves pre-generated public/sitemap-index.xml)
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
   ENV VALIDATION
═══════════════════════════════════════════════════════════════ */
const REQUIRED_ENV = [
  "DATABASE_URL",        /* preferred name — COCKROACH_URI also accepted below */
  "JWT_SECRET",
  "PAYSTACK_SECRET_KEY",
];

/*
 * Accept either DATABASE_URL or COCKROACH_URI for backward compatibility.
 * Normalise to DATABASE_URL so the rest of the file uses one name.
 */
if (!process.env.DATABASE_URL && process.env.COCKROACH_URI) {
  process.env.DATABASE_URL = process.env.COCKROACH_URI;
}

const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  missing.forEach((k) => console.error(`❌ Missing env: ${k}`));
  process.exit(1);
}

/* ═══════════════════════════════════════════════════════════════
   DATABASE
═══════════════════════════════════════════════════════════════ */
export const pool = new Pool({
  connectionString            : process.env.DATABASE_URL,
  ssl                         : { rejectUnauthorized: false },
  /*
   * min: 0 (default) — CockroachDB Serverless bills per open connection.
   * Setting min: 2 keeps 2 connections permanently open even when idle,
   * which increases cost for no benefit on serverless plans.
   */
  max                         : 15,
  idleTimeoutMillis           : 30_000,
  connectionTimeoutMillis     : 5_000,
  keepAlive                   : true,
  keepAliveInitialDelayMillis : 10_000,
  application_name            : "loemart-server",
});

pool.on("error", (err) =>
  console.error("🔥 Pool error:", err.message)
);

/* ═══════════════════════════════════════════════════════════════
   APP + SERVER
═══════════════════════════════════════════════════════════════ */
const app    = express();
const PORT   = Number(process.env.PORT) || 5000;
const server = http.createServer(app);

/*
 * trust proxy: 1 — trust exactly one hop (your load balancer / Render / Railway).
 * This makes req.ip return the real client IP from X-Forwarded-For.
 */
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

/* Evict expired entries every minute — unref so it doesn't block shutdown */
const _cacheEvictor = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _cache.entries())
    if (now > v.expires) _cache.delete(k);
}, 60_000);
_cacheEvictor.unref();

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
    /* Allow same-origin requests (origin is undefined for server-to-server) */
    if (!origin || ALLOWED_ORIGIN === "*" || ALLOWED_ORIGINS.has(origin))
      return cb(null, true);
    console.warn("[CORS] blocked:", origin);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials    : true,
  methods        : ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders : [
    "Content-Type",
    "Authorization",
    "x-requested-with",
    "x-request-id",
  ],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ═══════════════════════════════════════════════════════════════
   HELMET
═══════════════════════════════════════════════════════════════ */
app.use(helmet({
  /*
   * Content-Security-Policy: enabled with safe defaults for an API server.
   * The SPA sets its own CSP via meta tags or a separate middleware.
   * Keeping CSP: false on an API means browsers get no protection
   * if they ever render an error page from this server.
   */
  contentSecurityPolicy: {
    directives: {
      defaultSrc  : ["'self'"],
      scriptSrc   : ["'self'"],
      styleSrc    : ["'self'", "'unsafe-inline'"],
      imgSrc      : ["'self'", "data:", "https://res.cloudinary.com"],
      connectSrc  : ["'self'"],
      fontSrc     : ["'self'"],
      objectSrc   : ["'none'"],
      frameSrc    : ["'none'"],
      upgradeInsecureRequests: IS_PROD ? [] : null,
    },
  },
  crossOriginEmbedderPolicy : false,
  crossOriginOpenerPolicy   : { policy: "same-origin-allow-popups" },
  hsts                      : IS_PROD
    ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
    : false,
  referrerPolicy            : { policy: "strict-origin-when-cross-origin" },
}));

/* ═══════════════════════════════════════════════════════════════
   STATIC FILES
═══════════════════════════════════════════════════════════════ */
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge  : "7d",
  etag    : true,
  /*
   * dotfiles: "deny" — prevent serving .env, .git etc. if they somehow
   * end up inside the uploads directory.
   */
  dotfiles: "deny",
}));

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITERS
═══════════════════════════════════════════════════════════════ */
/*
 * keyGenerator reads req.ip which respects trust proxy = 1.
 * The previous version read x-forwarded-for directly, which
 * can be spoofed if trust proxy is not set — req.ip is safer.
 */
const makeKeyGenerator = (req) =>
  req.ip ?? req.socket?.remoteAddress ?? "unknown";

const globalLimiter = rateLimit({
  windowMs        : 60_000,
  max             : IS_PROD ? 120 : 1_000,
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : makeKeyGenerator,
  handler         : (_req, res) =>
    res.status(429).json({ success: false, message: "Too many requests." }),
});

const uploadLimiter = rateLimit({
  windowMs        : 60_000,
  max             : IS_PROD ? 20 : 200,
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : makeKeyGenerator,
  handler         : (_req, res) =>
    res.status(429).json({
      success: false, message: "Too many upload requests.",
    }),
});

/* ═══════════════════════════════════════════════════════════════
   ROUTE IMPORTS
═══════════════════════════════════════════════════════════════ */
import paymentRouter, { webhookRouter } from "./routes/payment.js";
import flwWebhookRouter                 from "./routes/webhooks/flutterwave.js";
import checkoutWebhookRouter            from "./routes/checkout/webhook.js";
import checkoutRouter                   from "./routes/checkout/index.js";
import authRouter                       from "./routes/sellerAuth.routes.js";
import sellerOnboardingRouter           from "./routes/sellerOnboarding.routes.js";
import sellerProfileRouter              from "./routes/sellerprofile.js";
import sellerPayoutRoutes               from "./routes/seller/payout.js";
import sellerDashboardRouter            from "./routes/seller/dashboard.js";
import sellerSettingsRouter             from "./routes/seller/settings.js";
import addproductRouter                 from "./routes/addproduct.js";
import marketRouter                     from "./routes/market/index.js";
import marketDetailRouter               from "./routes/marketDetail/index.js";
import productDetailRouter              from "./routes/productDetail.js";
import cartRouter                       from "./routes/cart/index.js";
import userRouter                       from "./routes/users.js";
import messagesRouter                   from "./routes/messages.js";
import conversationsRouter              from "./routes/conversations.js";
import adminRouter                      from "./routes/admin.js";
import searchRouter                     from "./routes/search.js";
import homepageRouter                   from "./routes/homepage.js";
import dashboardRoutes                  from "./routes/dashboard.js";
import notificationsRouter              from "./routes/notifications.js";
import walletRoutes                     from "./routes/wallets.js";
import p2pRouter                        from "./routes/p2p.js";
import verificationRouter               from "./routes/verification.js";
import couponsRouter                    from "./routes/coupons.js";
import spinwheelRouter                  from "./routes/spinwheel.js";

/* ═══════════════════════════════════════════════════════════════
   WEBHOOKS  — must be registered BEFORE body parsers
   Webhooks need the raw request body for signature verification.
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

/*
 * FLW capture endpoint — logs all Flutterwave events for debugging.
 * Non-critical: errors are swallowed so they never affect the 200 response.
 */
app.post(
  "/api/webhooks/flw-capture",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    const raw  = req.body?.toString?.() ?? "";
    const body = (() => {
      try { return JSON.parse(raw); }
      catch { return { raw }; }
    })();

    console.log("[flw-capture]", body?.event);

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

    return res.status(200).json({ captured: true });
  }
);

app.use(
  "/api/checkout/webhook/payment",
  express.raw({ type: "*/*" }),
  checkoutWebhookRouter
);

/* ═══════════════════════════════════════════════════════════════
   BODY PARSERS  — registered AFTER webhooks
═══════════════════════════════════════════════════════════════ */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ═══════════════════════════════════════════════════════════════
   REQUEST ID MIDDLEWARE
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
  /*
   * Fixed: original code had `!process.env.NODE_ENV !== "test"`
   * which evaluates as `(!"test") !== "test"` → `false !== "test"` → true,
   * meaning it logged in ALL environments including test.
   */
  if (process.env.NODE_ENV !== "test")
    console.log(
      `${new Date().toISOString()} | ${req.method} ${req.originalUrl}`
    );
  next();
});

/* ═══════════════════════════════════════════════════════════════
   GLOBAL RATE LIMIT
═══════════════════════════════════════════════════════════════ */
app.use(globalLimiter);

/* ═══════════════════════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════════════════════ */
app.use("/api/payment",           paymentRouter);
app.use("/api/checkout",          checkoutRouter);
app.use("/api/auth",              authRouter);
app.use("/api/seller-onboarding", sellerOnboardingRouter);
app.use("/api/seller",            sellerProfileRouter);
app.use("/api/seller/payout",     sellerPayoutRoutes);
app.use("/api/seller-dashboard",  sellerDashboardRouter);
app.use("/api/seller/settings",   sellerSettingsRouter);
app.use("/api/products",          marketRouter);
app.use("/api/shop",              marketDetailRouter);
app.use("/api/cart",              cartRouter);
app.use("/api/addproduct",        addproductRouter);
app.use("/api/product",           productDetailRouter);
app.use("/api/users",             userRouter);
app.use("/api/messages/upload",   uploadLimiter);
app.use("/api/messages",          messagesRouter);
app.use("/api/conversations",     conversationsRouter);
app.use("/api/admin",             adminRouter);
app.use("/api/search",            searchRouter);
app.use("/api/homepage",          homepageRouter);
app.use("/api/dashboard",         dashboardRoutes);
app.use("/api/notifications",     notificationsRouter);
app.use("/api/v1/wallets",        walletRoutes);
app.use("/api/p2p",               p2pRouter);
app.use("/api/verification",      verificationRouter);
app.use("/api/coupons",           couponsRouter);
app.use("/api/spinwheel",         spinwheelRouter);

/*
 * Duplicate removed:
 * app.use("/api/seller-dashboard", dashboardRoutes);  ← was mounted twice
 * The first mount at /api/seller-dashboard (sellerDashboardRouter) is kept.
 */

/* ═══════════════════════════════════════════════════════════════
   HEALTH CHECK
═══════════════════════════════════════════════════════════════ */
app.get("/api/health", async (_req, res) => {
  let dbOk = false, dbLatency = null, dbError = null;

  try {
    const t0       = Date.now();
    const { rows } = await pool.query("SELECT 1 AS ok");
    dbLatency      = Date.now() - t0;
    dbOk           = rows[0]?.ok == 1;
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
    },
    process: {
      uptime_s  : Math.floor(process.uptime()),
      memory_mb : Math.round(process.memoryUsage().rss / 1_048_576),
      node      : process.version,
    },
    cache        : { size: _cache.size },
    online_users : getOnlineCount(),
  });
});

/* ═══════════════════════════════════════════════════════════════
   SITEMAP + ROBOTS  (served as static files from public/)
═══════════════════════════════════════════════════════════════ */
const PUBLIC_DIR = path.join(__dirname, "public");

app.get("/sitemap-index.xml", (_req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "sitemap-index.xml"))
);
app.get("/sitemap.xml", (_req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "sitemap-index.xml"))
);
app.get("/sitemaps/:file", (req, res) => {
  const safe = path.basename(req.params.file);  /* prevent path traversal */
  res.sendFile(path.join(PUBLIC_DIR, "sitemaps", safe), (err) => {
    if (err) res.status(404).json({ success: false, message: "Sitemap not found" });
  });
});
app.get("/robots.txt", (_req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "robots.txt"))
);

/* ═══════════════════════════════════════════════════════════════
   SPA — production only
═══════════════════════════════════════════════════════════════ */
if (IS_PROD) {
  const dist = path.join(__dirname, "dist");

  app.use(express.static(dist, {
    maxAge  : "1d",
    dotfiles: "deny",
    setHeaders(res, fp) {
      if (/\.html?$/i.test(fp))
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    },
  }));

  /*
   * API 404 guard — must come BEFORE the SPA catch-all.
   * Without this, a typo like GET /api/produts returns index.html
   * instead of a 404 JSON response.
   */
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/"))
      return res
        .status(404)
        .json({ success: false, message: `Not found: ${req.method} ${req.path}` });
    next();
  });

  /* SPA catch-all — serves index.html for all non-API routes */
  app.get("*", (_req, res) =>
    res.sendFile(path.join(dist, "index.html"))
  );
}

/* ═══════════════════════════════════════════════════════════════
   404 — for non-production or unmatched routes
═══════════════════════════════════════════════════════════════ */
app.use((req, res) =>
  res.status(404).json({
    success : false,
    message : `Cannot ${req.method} ${req.originalUrl}`,
  })
);

/* ═══════════════════════════════════════════════════════════════
   GLOBAL ERROR HANDLER
═══════════════════════════════════════════════════════════════ */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const reqId = req.requestId ?? "unknown";
  console.error(`🔥 [${reqId}]`, err.message);

  /* Multer errors */
  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(400).json({ success: false, message: "File too large", reqId });
  if (err.code === "LIMIT_FILE_COUNT")
    return res.status(400).json({ success: false, message: "Too many files", reqId });
  if (err.code === "LIMIT_UNEXPECTED_FILE")
    return res.status(400).json({ success: false, message: "Unexpected file field", reqId });

  /* CORS */
  if (err.message?.startsWith("CORS"))
    return res.status(403).json({ success: false, message: err.message, reqId });

  /* Postgres constraint errors */
  if (err.code === "23505")
    return res.status(409).json({ success: false, message: "Duplicate entry", reqId });
  if (err.code === "23503")
    return res.status(400).json({ success: false, message: "Referenced record not found", reqId });
  if (err.code === "23514")
    return res.status(400).json({ success: false, message: "Database constraint violated", reqId });
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

  clearInterval(_cacheEvictor);

  /* Hard kill after 15 seconds if graceful shutdown stalls */
  const killTimer = setTimeout(() => {
    console.error("[server] shutdown timed out — forcing exit");
    process.exit(1);
  }, 15_000);
  killTimer.unref();

  server.close(async () => {
    /*
     * Close Socket.IO before the pool so in-flight socket messages
     * that touch the DB don't hit a closed pool.
     */
    try { io.close(); } catch { /* ignore */ }
    try { await pool.end(); } catch { /* ignore */ }
    clearTimeout(killTimer);
    console.log("[server] shutdown complete");
    process.exit(0);
  });
}

process.on("SIGTERM",            () => shutdown("SIGTERM"));
process.on("SIGINT",             () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled rejection:", reason);
  if (!IS_PROD) process.exit(1);
});
process.on("uncaughtException",  (err) => {
  console.error("[server] Uncaught exception:", err.message);
  shutdown("uncaughtException");
});

/* ═══════════════════════════════════════════════════════════════
   START
═══════════════════════════════════════════════════════════════ */
try {
  const { rows } = await pool.query("SELECT version()");
  /*
   * CockroachDB version string: "CockroachDB CCL v23.2.0 (...)"
   * PostgreSQL version string:  "PostgreSQL 15.4 on x86_64 ..."
   * Splitting on " " and taking [0]+[1] covers both formats safely.
   */
  const versionParts = rows[0]?.version?.split(" ") ?? [];
  const versionLabel = versionParts.slice(0, 2).join(" ") || "unknown";
  console.log(`✅ Database: ${versionLabel}`);
} catch (err) {
  console.error("❌ DB connection failed:", err.message);
  process.exit(1);
}

server.listen(PORT, () => {
  console.log(
    `\n🚀 Loemart on port ${PORT}` +
    ` | ${process.env.NODE_ENV || "development"}\n`
  );
});

export default app;