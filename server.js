/**
 * server.js — v3
 * ─────────────────────────────────────────────────────────────
 * ✓ Fixed seller product router mount point (/api/seller not
 *   /api/seller/products — prefix was doubling)
 * ✓ Fixed seller order router mount point (same pattern)
 * ✓ All seller sub-routes mounted in correct order
 * ✓ ENV validation covers all critical secrets
 * ✓ Pool created once — exported for config/db.js alias
 * ✓ CORS origin set hardened
 * ✓ Webhook routes before body parsers (raw body preserved)
 * ✓ All cron intervals unref'd (never block process exit)
 * ✓ Graceful shutdown covers server + pool + io
 * ✓ unhandledRejection never silently exits in prod
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

/* ════════════════════════════════════════════════════════════
   ENV VALIDATION
   ─────────────────────────────────────────────────────────
   Crash immediately at startup if any required variable is
   absent. Silent missing vars are a production incident
   waiting to happen.
════════════════════════════════════════════════════════════ */
const REQUIRED_ENV = [
  "COCKROACH_URI",
  "JWT_SECRET",
  "PAYSTACK_SECRET_KEY",
];

const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length) {
  missingEnv.forEach((k) => console.error(`❌  Missing env var: ${k}`));
  process.exit(1);
}

/* ════════════════════════════════════════════════════════════
   DATABASE
   ─────────────────────────────────────────────────────────
   Single Pool instance for the entire process.
   Exported so config/db.js can re-export it without creating
   a second pool. Never import pg directly elsewhere.
════════════════════════════════════════════════════════════ */
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

pool.on("error", (err) =>
  console.error("🔥 [pool] idle client error:", err.message)
);

/* ════════════════════════════════════════════════════════════
   APP + HTTP SERVER
════════════════════════════════════════════════════════════ */
const app    = express();
const PORT   = Number(process.env.PORT) || 5000;
const server = http.createServer(app);

/*
 * trust proxy — required behind Render / Nginx / Cloudflare.
 * Makes req.ip reflect the real client IP from X-Forwarded-For
 * rather than the load-balancer address. Needed for rate-
 * limiting to work correctly per real client.
 */
app.set("trust proxy", 1);

/* ════════════════════════════════════════════════════════════
   SOCKET.IO
════════════════════════════════════════════════════════════ */
import { initSocket, getOnlineCount } from "./socket.js";

const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || "*";
export const io      = initSocket(server, ALLOWED_ORIGIN);

/* ════════════════════════════════════════════════════════════
   IN-MEMORY CACHE
   ─────────────────────────────────────────────────────────
   Simple TTL cache for lightweight hot-path data.
   Not shared across workers — use Redis for multi-process.
════════════════════════════════════════════════════════════ */
const _cache    = new Map();
const CACHE_TTL = 60_000;   // 1 minute default

export const setCache = (key, value, ttl = CACHE_TTL) =>
  _cache.set(key, { value, expires: Date.now() + ttl });

export const getCache = (key) => {
  const item = _cache.get(key);
  if (!item)                     return null;
  if (Date.now() > item.expires) { _cache.delete(key); return null; }
  return item.value;
};

export const deleteCache      = (key)    => _cache.delete(key);
export const clearCachePattern = (prefix) => {
  for (const key of _cache.keys())
    if (key.startsWith(prefix)) _cache.delete(key);
};

/* Periodic eviction — unref so it never blocks clean exit */
const _cacheEviction = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _cache.entries())
    if (now > v.expires) _cache.delete(k);
}, 60_000);
_cacheEviction.unref();

/* ════════════════════════════════════════════════════════════
   CORS
   ─────────────────────────────────────────────────────────
   Hard-coded production origins + anything in CLIENT_ORIGIN
   env var (comma-separated). In development CLIENT_ORIGIN="*"
   allows all origins.
════════════════════════════════════════════════════════════ */
const HARD_ALLOWED_ORIGINS = new Set([
  "https://www.loemart.com",
  "https://loemart.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
]);

const _envOrigins = ALLOWED_ORIGIN === "*"
  ? []
  : ALLOWED_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);

const ALLOWED_ORIGINS = new Set([
  ..._envOrigins,
  ...HARD_ALLOWED_ORIGINS,
]);

const corsOptions = {
  origin(origin, cb) {
    /* Allow server-to-server / curl (no Origin header) */
    if (!origin)                    return cb(null, true);
    if (ALLOWED_ORIGIN === "*")     return cb(null, true);
    if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);

    console.warn("[CORS] blocked origin:", origin);
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
/* Preflight — liberal to avoid OPTIONS 404s */
app.options("*", cors({ origin: true, credentials: true }));

/* ════════════════════════════════════════════════════════════
   HELMET
════════════════════════════════════════════════════════════ */
app.use(helmet({
  contentSecurityPolicy     : false,
  crossOriginEmbedderPolicy : false,
  crossOriginOpenerPolicy   : { policy: "same-origin-allow-popups" },
  hsts                      : IS_PROD
    ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
    : false,
  referrerPolicy : { policy: "strict-origin-when-cross-origin" },
}));

/* ════════════════════════════════════════════════════════════
   STATIC — uploaded files
════════════════════════════════════════════════════════════ */
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge : "7d",
    etag   : true,
  })
);

/* ════════════════════════════════════════════════════════════
   RATE LIMITERS
   ─────────────────────────────────────────────────────────
   ipKey reads the real IP after trust proxy is set.
   Upload limiter is applied specifically to message upload
   routes which hit R2/S3.
════════════════════════════════════════════════════════════ */
const ipKey = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0].trim() ??
  req.socket.remoteAddress ??
  "unknown";

const globalLimiter = rateLimit({
  windowMs        : 60_000,
  max             : IS_PROD ? 120 : 1_000,
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : ipKey,
  handler         : (_req, res) =>
    res.status(429).json({ success: false, message: "Too many requests." }),
});

const uploadLimiter = rateLimit({
  windowMs        : 60_000,
  max             : IS_PROD ? 20 : 200,
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : ipKey,
  handler         : (_req, res) =>
    res.status(429).json({
      success : false,
      message : "Too many upload requests. Please wait a moment.",
    }),
});

/* ════════════════════════════════════════════════════════════
   ROUTE IMPORTS
════════════════════════════════════════════════════════════ */

/* ── Payments ── */
import paymentRouter, { webhookRouter } from "./routes/payment.js";
import flwWebhookRouter                 from "./routes/webhooks/flutterwave.js";
import checkoutWebhookRouter            from "./routes/checkout/webhook.js";
import checkoutRouter                   from "./routes/checkout/createOrder.js";

/* ── Marketplace auth (public.users) ── */
import authRouter           from "./routes/auth.routes.js";
import forgotPasswordRouter from "./routes/forgotPassword.js";
import resetPasswordRouter  from "./routes/resetPassword.js";

/* ── Seller auth (market.users) ── */
import sellerAuthRouter from "./routes/sellerAuth.routes.js";

/* ── Seller sub-routes ──────────────────────────────────────
   MOUNT ORDER IS CRITICAL.

   Rules:
     1. More specific paths BEFORE less specific paths.
     2. Catch-all profile router (/api/seller) MUST be last.
     3. Each router owns its own path prefix internally —
        the mount point provides only the parent namespace.

   Route ownership:
     sellerOrderRouter        owns /orders/*
     sellerProductRouter      owns /products/*      ← FIX: was mounted at
     sellerPayoutRoutes       owns /payout/*           /api/seller/products
     sellerSettingsRouter     owns /settings/*         which doubled the prefix
     sellerNotificationsRouter owns /notifications/*
     sellerProfileRouter      owns everything else  ← catch-all, LAST
─────────────────────────────────────────────────────────── */
import sellerOnboardingRouter     from "./routes/sellerOnboarding.routes.js";
import sellerOrderRouter          from "./routes/seller/order.js";
import sellerProductRouter        from "./routes/seller/product.js";
import sellerPayoutRoutes         from "./routes/seller/payout.js";
import sellerSettingsRouter       from "./routes/seller/settings.js";
import sellerNotificationsRouter  from "./routes/seller/notifications.js";
import sellerProfileRouter        from "./routes/sellerprofile.js";

/* ── Seller Dashboard (legacy) ── */
import sellerDashboardRouter from "./routes/dashboard.js";

/* ── Marketplace products ── */
import marketRouter        from "./routes/market/index.js";
import marketDetailRouter  from "./routes/marketDetail/index.js";
import productDetailRouter from "./routes/productDetail.js";
import cartRouter          from "./routes/cart/index.js";
import addproductRouter    from "./routes/addproduct.js";
import editproductRouter   from "./routes/editproduct.js";
import promotePlansRouter  from "./routes/promoteplans.js";

/* ── Users ── */
import userRouter        from "./routes/users.js";
import editProfileRouter from "./routes/editProfile.js";

/* ── Messaging ── */
import messagesRouter      from "./routes/messages.js";
import conversationsRouter from "./routes/conversations.js";

/* ── Platform ── */
import adminRouter         from "./routes/admin.js";
import searchRouter        from "./routes/search.js";
import homepageRouter      from "./routes/homepage.js";
import notificationsRouter from "./routes/notifications.js";
import walletRoutes        from "./routes/wallets.js";
import p2pRouter           from "./routes/p2p.js";
import verificationRouter  from "./routes/verification.js";
import couponsRouter       from "./routes/coupons.js";
import spinwheelRouter     from "./routes/spinwheel.js";
import referralRoutes      from "./routes/referrals.js";
import leaderboardRoutes   from "./routes/leaderboard.js";
import favoritesRouter     from "./routes/favorites.js";
import subscriptionRouter  from "./routes/subscription/index.js";

/* ── Airtime ── */
import airtimeCouponRoutes, { initSchema as initAirtimeSchema }
  from "./routes/airtimeCoupons.js";

/* ── Settings + Support ── */
import settingsRouter from "./routes/settings.js";
import supportRouter  from "./routes/support.js";

/* ── SSR + Sitemap ── */
import ssrRouter     from "./routes/ssr.js";
import sitemapRouter from "./routes/sitemap.js";

/* ── Background jobs ── */
import { startListingExpiryJob } from "./jobs/listingExpiry.js";
import { startCleanupJob }       from "./jobs/cleanupDeletedProducts.js";
import { initLeaderboardCron }   from "./services/leaderboardCron.js";
import { purgeDeletedAccounts }  from "./crons/purgeDeletedAccounts.js";

/* ── Email services ── */
import { sendWeeklyNewsletter } from "./services/weeklyNewsletter.js";
import { processInactiveUsers } from "./services/inactiveUsers.js";

/* ════════════════════════════════════════════════════════════
   WEBHOOKS — before body parsers
   ─────────────────────────────────────────────────────────
   Raw body MUST be preserved for HMAC signature verification.
   These routes use express.raw() — never express.json().
════════════════════════════════════════════════════════════ */

/* ── Paystack ── */
app.use(
  "/api/payment/webhook",
  express.raw({ type: "*/*" }),
  webhookRouter
);

/* ── Flutterwave ── */
app.use(
  "/api/webhooks/flutterwave",
  express.raw({ type: "*/*" }),
  (req, _res, next) => {
    const raw = req.body?.toString?.() ?? "";
    try {
      req.body = JSON.parse(raw);
    } catch (parseErr) {
      console.warn(
        "[webhook/flw] Body parse failed — passing raw string.",
        "Error:", parseErr.message,
        "| Raw (first 200 chars):", raw.slice(0, 200)
      );
      req.body = { _raw: raw };
    }
    next();
  },
  flwWebhookRouter
);

/* ── Flutterwave audit capture ── */
app.post(
  "/api/webhooks/flw-capture",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    const raw  = req.body?.toString?.() ?? "";
    const body = (() => {
      try   { return JSON.parse(raw); }
      catch { return { _raw: raw };   }
    })();

    console.log("[webhook/flw-capture] event:", body?.event ?? "unknown");

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
    } catch (dbErr) {
      /* Non-critical — log but don't fail the 200 response */
      console.warn("[webhook/flw-capture] DB insert failed:", dbErr.message);
    }

    return res.status(200).json({ captured: true });
  }
);

/* ── Checkout payment webhook ── */
app.use(
  "/api/checkout/webhook/payment",
  express.raw({ type: "*/*" }),
  checkoutWebhookRouter
);

/* ════════════════════════════════════════════════════════════
   BODY PARSERS — after webhook routes
════════════════════════════════════════════════════════════ */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ════════════════════════════════════════════════════════════
   REQUEST ID
   ─────────────────────────────────────────────────────────
   Echoed back in X-Request-Id header and error responses
   so client-side errors can be correlated with server logs.
════════════════════════════════════════════════════════════ */
app.use((req, res, next) => {
  const id      = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
});

/* ════════════════════════════════════════════════════════════
   REQUEST LOGGER
════════════════════════════════════════════════════════════ */
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== "test")
    console.log(
      `${new Date().toISOString()} | ${req.method} ${req.originalUrl}`
    );
  next();
});

/* ════════════════════════════════════════════════════════════
   GLOBAL RATE LIMIT
════════════════════════════════════════════════════════════ */
app.use(globalLimiter);

/* ════════════════════════════════════════════════════════════
   API ROUTES
════════════════════════════════════════════════════════════ */

/* ── Payments ── */
app.use("/api/payment",  paymentRouter);
app.use("/api/checkout", checkoutRouter);

/* ── Marketplace auth (public.users) ── */
app.use("/api/auth", authRouter);
app.use("/api/auth", forgotPasswordRouter);
app.use("/api/auth", resetPasswordRouter);

/* ── Seller auth (market.users JWT) ── */
app.use("/api/seller-auth", sellerAuthRouter);

/* ── Seller onboarding ── */
app.use("/api/seller-onboarding", sellerOnboardingRouter);

/* ════════════════════════════════════════════════════════════
   SELLER SUB-ROUTES
   ─────────────────────────────────────────────────────────
   All mounted at /api/seller. Each router owns its own
   internal prefix — the mount point is the shared namespace.

   KEY FIX (v3):
     sellerProductRouter was previously mounted at
     /api/seller/products. The router already defines routes
     as GET /products, PUT /products/:id etc, so Express was
     building: /api/seller/products/products — a 404.

     Correct mount is /api/seller so the final paths become:
       GET  /api/seller/products
       PUT  /api/seller/products/:id
     etc.

   Same fix applied to sellerOrderRouter.

   ORDER RULES:
     1. Named sub-paths (/orders, /products, /payout …) FIRST
     2. Catch-all sellerProfileRouter LAST
════════════════════════════════════════════════════════════ */

/*
 * sellerOrderRouter  — owns /orders, /orders/stats, /orders/:id …
 * sellerProductRouter — owns /products, /products/:id …
 *
 * Both mounted at /api/seller (not /api/seller/orders or
 * /api/seller/products) because the routers define those
 * prefixes themselves.
 */
app.use("/api/seller", sellerOrderRouter);          /* GET /api/seller/orders/…   */
app.use("/api/seller", sellerProductRouter);        /* GET /api/seller/products/… */
app.use("/api/seller", sellerPayoutRoutes);         /* /api/seller/payout/…       */
app.use("/api/seller", sellerSettingsRouter);       /* /api/seller/settings/…     */
app.use("/api/seller", sellerNotificationsRouter);  /* /api/seller/notifications/ */

/*
 * Profile catch-all — MUST be last under /api/seller.
 * Express matches routes in registration order; placing this
 * first would swallow all other /api/seller/* requests.
 */
app.use("/api/seller", sellerProfileRouter);

/* ── Seller Dashboard (legacy) ── */
app.use("/api/seller-dashboard", sellerDashboardRouter);

/* ── Marketplace products ── */
app.use("/api/products",     marketRouter);
app.use("/api/shop",         marketDetailRouter);
app.use("/api/cart",         cartRouter);
app.use("/api/addproduct",   addproductRouter);
app.use("/api/addproduct",   editproductRouter);
app.use("/api/product",      productDetailRouter);
app.use("/api/promoteplans", promotePlansRouter);

/* ── Users ── */
app.use("/api/users",        userRouter);
app.use("/api/edit-profile", editProfileRouter);

/* ── Messaging ── */
app.use("/api/messages/upload", uploadLimiter);     /* rate-limit uploads first */
app.use("/api/messages",        messagesRouter);
app.use("/api/conversations",   conversationsRouter);

/* ── Platform ── */
app.use("/api/admin",           adminRouter);
app.use("/api/search",          searchRouter);
app.use("/api/homepage",        homepageRouter);
app.use("/api/notifications",   notificationsRouter);
app.use("/api/v1/wallets",      walletRoutes);
app.use("/api/p2p",             p2pRouter);
app.use("/api/verification",    verificationRouter);
app.use("/api/coupons",         couponsRouter);
app.use("/api/spinwheel",       spinwheelRouter);
app.use("/api/referrals",       referralRoutes);
app.use("/api/leaderboard",     leaderboardRoutes);
app.use("/api/favorites",       favoritesRouter);
app.use("/api/airtime-coupons", airtimeCouponRoutes);
app.use("/api/subscription",    subscriptionRouter);

/* ── Settings + Support ── */
app.use("/api/settings", settingsRouter);
app.use("/api/support",  supportRouter);

/* ════════════════════════════════════════════════════════════
   HEALTH CHECK
════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════
   STATIC — sitemap + robots
════════════════════════════════════════════════════════════ */
const PUBLIC_DIR = path.join(__dirname, "public");

app.get("/sitemap-index.xml", (_req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "sitemap-index.xml"))
);
app.get("/sitemap.xml", (_req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "sitemap-index.xml"))
);
app.get("/sitemaps/:file", (req, res) => {
  const safe = path.basename(req.params.file);  /* strip path traversal */
  res.sendFile(path.join(PUBLIC_DIR, "sitemaps", safe), (err) => {
    if (err)
      res.status(404).json({ success: false, message: "Sitemap not found" });
  });
});
app.get("/robots.txt", (_req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "robots.txt"))
);

/* ════════════════════════════════════════════════════════════
   SSR + SPA FALLBACK — production only
════════════════════════════════════════════════════════════ */
if (IS_PROD) {
  const dist = path.join(__dirname, "dist");

  app.use(ssrRouter);
  app.use(sitemapRouter);

  app.use(
    express.static(dist, {
      maxAge     : "1d",
      setHeaders(res, fp) {
        /* HTML must never be cached — ensures fresh deploys land */
        if (/\.html?$/i.test(fp))
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      },
    })
  );

  /*
   * API 404 — before SPA catch-all.
   * Without this, unknown /api/* paths fall through to index.html
   * which returns a 200 with HTML, confusing API clients.
   */
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/"))
      return res.status(404).json({
        success : false,
        message : `Not found: ${req.method} ${req.path}`,
      });
    next();
  });

  /* SPA catch-all — must be last */
  app.get("*", (_req, res) =>
    res.sendFile(path.join(dist, "index.html"))
  );
}

/* ════════════════════════════════════════════════════════════
   404 — development only
   (Production 404s are handled above before the SPA fallback)
════════════════════════════════════════════════════════════ */
if (!IS_PROD) {
  app.use((req, res) =>
    res.status(404).json({
      success : false,
      message : `Cannot ${req.method} ${req.originalUrl}`,
    })
  );
}

/* ════════════════════════════════════════════════════════════
   GLOBAL ERROR HANDLER
   ─────────────────────────────────────────────────────────
   Four-argument signature required by Express to recognise
   this as an error handler — do not remove _next.
════════════════════════════════════════════════════════════ */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const reqId = req.requestId ?? "unknown";
  console.error(`🔥 [${reqId}] ${err.message}`);
  if (!IS_PROD) console.error(err.stack);

  /* ── Multer ── */
  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(400).json({
      success: false, message: "File too large", reqId,
    });
  if (err.code === "LIMIT_FILE_COUNT")
    return res.status(400).json({
      success: false, message: "Too many files", reqId,
    });
  if (err.code === "LIMIT_UNEXPECTED_FILE")
    return res.status(400).json({
      success: false, message: "Unexpected file field", reqId,
    });

  /* ── CORS ── */
  if (err.message?.startsWith("CORS"))
    return res.status(403).json({
      success: false, message: err.message, reqId,
    });

  /* ── PostgreSQL / CockroachDB ── */
  const PG_ERRORS = {
    "23505" : [409, "Duplicate entry"],
    "23503" : [400, "Referenced record not found"],
    "23514" : [400, "Constraint violated"],
    "22P02" : [400, "Invalid input format"],
    "42P01" : [500, "Table not found — run migrations"],
    "42703" : [500, "Column not found — run migrations"],
  };

  if (PG_ERRORS[err.code]) {
    const [status, message] = PG_ERRORS[err.code];
    return res.status(status).json({ success: false, message, reqId });
  }

  /* ── Default ── */
  const status  = err.status ?? err.statusCode ?? 500;
  const message = IS_PROD && status === 500
    ? "Internal server error"
    : (err.message ?? "Internal server error");

  return res.status(status).json({ success: false, message, reqId });
});

/* ════════════════════════════════════════════════════════════
   GRACEFUL SHUTDOWN
   ─────────────────────────────────────────────────────────
   SIGTERM: sent by Render / Docker on deploy / scale-down.
   SIGINT:  Ctrl-C in development.

   Sequence:
     1. Stop accepting new connections (server.close)
     2. Close Socket.IO (drains existing WS connections)
     3. Drain + close the DB pool
     4. Exit 0
   Force-exit after 15 s if anything hangs.
════════════════════════════════════════════════════════════ */
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[server] ${signal} received — shutting down gracefully…`);
  clearInterval(_cacheEviction);

  /* Force exit if shutdown hangs */
  const forceExit = setTimeout(() => {
    console.error("[server] forced exit after 15 s timeout");
    process.exit(1);
  }, 15_000);
  forceExit.unref();

  server.close(async () => {
    try   { io.close();       console.log("[server] Socket.IO closed"); }
    catch (_e) { /* already closed */ }

    try   { await pool.end(); console.log("[server] DB pool closed"); }
    catch (_e) { /* already closed */ }

    clearTimeout(forceExit);
    console.log("[server] clean exit ✓");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

/*
 * Unhandled rejections: log loudly everywhere.
 * Exit in dev so the bug is immediately visible.
 * In prod, let the process monitor (Render) decide to restart —
 * exiting blindly could drop in-flight requests.
 */
process.on("unhandledRejection", (reason) => {
  console.error("[server] ⚠️  Unhandled promise rejection:", reason);
  if (!IS_PROD) process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("[server] 💥 Uncaught exception:", err.message);
  if (!IS_PROD) console.error(err.stack);
  shutdown("uncaughtException");
});

/* ════════════════════════════════════════════════════════════
   START
════════════════════════════════════════════════════════════ */
async function start() {

  /* 1 — Verify DB is reachable before opening to traffic */
  try {
    const { rows } = await pool.query("SELECT version()");
    console.log("✅ CockroachDB connected:", rows[0].version.split(" ")[0]);
  } catch (err) {
    console.error("❌ DB connection failed:", err.message);
    process.exit(1);
  }

  /* 2 — Schema initializations */
  try {
    await initAirtimeSchema();
    console.log("✅ [airtime] schema ready");
  } catch (err) {
    if (IS_PROD) {
      console.error("❌ [airtime] schema init failed:", err.message);
      process.exit(1);
    } else {
      console.warn("⚠️  [airtime] schema init failed (non-fatal in dev):", err.message);
    }
  }

  /* 3 — Background jobs */
  startListingExpiryJob();
  startCleanupJob();
  initLeaderboardCron();

  /* 4 — Cron jobs (node-cron is optional — warn if missing) */
  await (async () => {
    let cron;
    try {
      ({ default: cron } = await import("node-cron"));
    } catch {
      console.warn(
        "[cron] node-cron not installed — scheduled jobs disabled.\n" +
        "       Run: npm install node-cron"
      );
      return;
    }

    /* Daily account purge — 02:00 UTC */
    cron.schedule("0 2 * * *", () =>
      purgeDeletedAccounts().catch((err) =>
        console.error("[cron] purgeDeletedAccounts:", err.message)
      )
    );

    /* Weekly newsletter — Monday 08:00 UTC */
    cron.schedule("0 8 * * 1", () =>
      sendWeeklyNewsletter().catch((err) =>
        console.error("[cron] weeklyNewsletter:", err.message)
      )
    );

    /* Inactive user nudges — daily 09:00 UTC */
    cron.schedule("0 9 * * *", () =>
      processInactiveUsers().catch((err) =>
        console.error("[cron] inactiveUsers:", err.message)
      )
    );

    console.log("✅ [cron] Account purge     → daily    02:00 UTC");
    console.log("✅ [cron] Weekly newsletter → Monday   08:00 UTC");
    console.log("✅ [cron] Inactive users    → daily    09:00 UTC");
  })();

  /* 5 — Open HTTP server (last — only after everything is ready) */
  server.listen(PORT, () => {
    const env = process.env.NODE_ENV || "development";
    console.log(`\n🚀 Loemart server  |  port=${PORT}  |  env=${env}`);
    console.log(`
  ═══════════════════════════════════════════════════════
  ROUTE MAP
  ═══════════════════════════════════════════════════════

  ── Seller Auth  (market.users JWT) ────────────────────
    POST  /api/seller-auth/register
    POST  /api/seller-auth/verify-email
    POST  /api/seller-auth/login
    GET   /api/seller-auth/me

  ── Seller Orders ──────────────────────────────────────
    GET   /api/seller/orders
    GET   /api/seller/orders/stats
    GET   /api/seller/orders/:id
    PATCH /api/seller/orders/:id/status

  ── Seller Products ────────────────────────────────────
    GET    /api/seller/products
    GET    /api/seller/products/:id
    PUT    /api/seller/products/:id
    PATCH  /api/seller/products/:id/pause
    PATCH  /api/seller/products/:id/images
    DELETE /api/seller/products/:id/images/:imgId
    DELETE /api/seller/products/:id
    POST   /api/products    ← addproduct (authenticateSeller)

  ── Seller Payout ──────────────────────────────────────
    /api/seller/payout/*

  ── Seller Settings ────────────────────────────────────
    /api/seller/settings/*

  ── Seller Notifications ───────────────────────────────
    /api/seller/notifications/*

  ── Seller Profile (catch-all) ─────────────────────────
    /api/seller/*

  ── Checkout ───────────────────────────────────────────
    POST /api/checkout
    POST /api/checkout/retry-payment
    GET  /api/checkout/orders
    GET  /api/checkout/orders/:id

  ── Health ─────────────────────────────────────────────
    GET  /api/health

  ═══════════════════════════════════════════════════════
    `);
  });
}

start().catch((err) => {
  console.error("❌ Fatal startup error:", err.message);
  process.exit(1);
});

export default app;