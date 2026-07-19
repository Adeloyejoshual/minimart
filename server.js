/**
 * server.js — complete file with support routes added
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

/* ── Env validation ── */
const REQUIRED_ENV = ["COCKROACH_URI", "JWT_SECRET", "PAYSTACK_SECRET_KEY"];
const missing      = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  missing.forEach((k) => console.error(`❌ Missing env: ${k}`));
  process.exit(1);
}

/* ── Database ── */
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

pool.on("error", (err) => console.error("🔥 Pool error:", err.message));

/* ── App + server ── */
const app    = express();
const PORT   = Number(process.env.PORT) || 5000;
const server = http.createServer(app);
app.set("trust proxy", 1);

/* ── Socket.IO ── */
import { initSocket, getOnlineCount } from "./socket.js";
const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || "*";
export const io      = initSocket(server, ALLOWED_ORIGIN);

/* ── Cache ── */
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
const _ev = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _cache.entries()) if (now > v.expires) _cache.delete(k);
}, 60_000);
_ev.unref();

/* ── CORS ── */
const HARD_ALLOWED = [
  "https://www.loemart.com",
  "https://loemart.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
];
const _envOrigins     = ALLOWED_ORIGIN === "*"
  ? []
  : ALLOWED_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
const ALLOWED_ORIGINS = new Set([..._envOrigins, ...HARD_ALLOWED]);

app.use(cors({
  origin(origin, cb) {
    if (!origin || ALLOWED_ORIGIN === "*" || ALLOWED_ORIGINS.has(origin))
      return cb(null, true);
    console.warn("[CORS] blocked:", origin);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials    : true,
  methods        : ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders : ["Content-Type","Authorization","x-requested-with","x-request-id"],
}));
app.options("*", cors({ origin: true, credentials: true }));

/* ── Helmet ── */
app.use(helmet({
  contentSecurityPolicy     : false,
  crossOriginEmbedderPolicy : false,
  crossOriginOpenerPolicy   : { policy: "same-origin-allow-popups" },
  hsts                      : IS_PROD
    ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
    : false,
  referrerPolicy            : { policy: "strict-origin-when-cross-origin" },
}));

/* ── Static uploads ── */
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge: "7d", etag: true,
}));

/* ── Rate limiters ── */
const globalLimiter = rateLimit({
  windowMs        : 60_000,
  max             : IS_PROD ? 120 : 1_000,
  standardHeaders : true,
  legacyHeaders   : false,
  keyGenerator    : (req) =>
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ??
    req.socket.remoteAddress ?? "unknown",
  handler: (_req, res) =>
    res.status(429).json({ success: false, message: "Too many requests." }),
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
    res.status(429).json({ success: false, message: "Too many upload requests." }),
});

/* ══════════════════════════════════════════════════════════════
   ROUTE IMPORTS
══════════════════════════════════════════════════════════════ */
import paymentRouter, { webhookRouter } from "./routes/payment.js";
import flwWebhookRouter                 from "./routes/webhooks/flutterwave.js";
import checkoutWebhookRouter            from "./routes/checkout/webhook.js";
import checkoutRouter                   from "./routes/checkout/index.js";

/* ── Auth ── */
import authRouter           from "./routes/auth.routes.js";
import forgotPasswordRouter from "./routes/forgotPassword.js";
import resetPasswordRouter  from "./routes/resetPassword.js";

/* ── Seller ── */
import sellerOnboardingRouter from "./routes/sellerOnboarding.routes.js";
import sellerProfileRouter    from "./routes/sellerprofile.js";
import sellerPayoutRoutes     from "./routes/seller/payout.js";
import sellerSettingsRouter   from "./routes/seller/settings.js";

/* ── Seller Dashboard ── */
import sellerDashboardRouter from "./routes/dashboard.js";

/* ── Products + marketplace ── */
import addproductRouter    from "./routes/addproduct.js";
import marketRouter        from "./routes/market/index.js";
import marketDetailRouter  from "./routes/marketDetail/index.js";
import productDetailRouter from "./routes/productDetail.js";
import cartRouter          from "./routes/cart/index.js";

/* ── Users ── */
import userRouter        from "./routes/users.js";
import editProfileRouter from "./routes/editProfile.js";

/* ── Messaging ── */
import messagesRouter      from "./routes/messages.js";
import conversationsRouter from "./routes/conversations.js";

/* ── Platform ── */
import adminRouter          from "./routes/admin.js";
import searchRouter         from "./routes/search.js";
import homepageRouter       from "./routes/homepage.js";
import notificationsRouter  from "./routes/notifications.js";
import walletRoutes         from "./routes/wallets.js";
import p2pRouter            from "./routes/p2p.js";
import verificationRouter   from "./routes/verification.js";
import couponsRouter        from "./routes/coupons.js";
import spinwheelRouter      from "./routes/spinwheel.js";
import referralRoutes       from "./routes/referrals.js";
import leaderboardRoutes    from "./routes/leaderboard.js";
import favoritesRouter      from "./routes/favorites.js";
import airtimeCouponRoutes  from "./routes/airtimeCoupons.js";
import subscriptionRouter   from "./routes/subscription/index.js";
import editproductRouter from "./routes/editproduct.js";
import promotePlansRouter from "./routes/promoteplans.js";
import settingsRouter from "./routes/settings.js";

/* ── Help & Support ─────────────────────────────────────────
   /api/support        → routes/support.js       (user-facing)
   /api/admin/support  → routes/admin/support.js (admin panel)
   NOTE: adminRouter already mounts routes/admin/support.js
   internally via router.use("/support", supportAdminRouter)
   so we only need to mount the user-facing router here.
──────────────────────────────────────────────────────────────*/
import supportRouter from "./routes/support.js";

/* ── Background jobs ── */
import { startListingExpiryJob } from "./jobs/listingExpiry.js";
import { startCleanupJob }       from "./jobs/cleanupDeletedProducts.js";
import { initLeaderboardCron }   from "./services/leaderboardCron.js";

/* ══════════════════════════════════════════════════════════════
   WEBHOOKS  — must be BEFORE body parsers
══════════════════════════════════════════════════════════════ */
app.use("/api/payment/webhook",
  express.raw({ type: "*/*" }),
  webhookRouter
);

app.use("/api/webhooks/flutterwave",
  express.raw({ type: "*/*" }),
  (req, _res, next) => {
    try   { req.body = JSON.parse(req.body.toString()); }
    catch { req.body = {}; }
    next();
  },
  flwWebhookRouter
);

app.post("/api/webhooks/flw-capture",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    const raw  = req.body?.toString?.() ?? "";
    const body = (() => { try { return JSON.parse(raw); } catch { return { raw }; } })();
    console.log("[webhook] FLW CAPTURE:", body?.event);
    try {
      await pool.query(
        `INSERT INTO market.webhook_logs (source, event, payload, headers, created_at)
         VALUES ('flw_capture', $1, $2, $3, NOW())`,
        [body?.event ?? "unknown", JSON.stringify(body), JSON.stringify(req.headers)]
      );
    } catch { /* non-critical */ }
    return res.status(200).json({ captured: true });
  }
);

app.use("/api/checkout/webhook/payment",
  express.raw({ type: "*/*" }),
  checkoutWebhookRouter
);

/* ══════════════════════════════════════════════════════════════
   BODY PARSERS  — after webhooks
══════════════════════════════════════════════════════════════ */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ── Request ID ── */
app.use((req, res, next) => {
  const id = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
});

/* ── Request logger ── */
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== "test")
    console.log(`${new Date().toISOString()} | ${req.method} ${req.originalUrl}`);
  next();
});

/* ── Global rate limit ── */
app.use(globalLimiter);

/* ══════════════════════════════════════════════════════════════
   ROUTES
══════════════════════════════════════════════════════════════ */

/* ── Payments ── */
app.use("/api/payment",  paymentRouter);
app.use("/api/checkout", checkoutRouter);

/* ── Auth ── */
app.use("/api/auth", authRouter);
app.use("/api/auth", forgotPasswordRouter);
app.use("/api/auth", resetPasswordRouter);

/* ── Users ── */
app.use("/api/users",        userRouter);
app.use("/api/edit-profile", editProfileRouter);

/* ── Seller ── */
app.use("/api/seller-onboarding", sellerOnboardingRouter);
app.use("/api/seller",            sellerProfileRouter);
app.use("/api/seller/payout",     sellerPayoutRoutes);
app.use("/api/seller/settings",   sellerSettingsRouter);
app.use("/api/seller-dashboard",  sellerDashboardRouter);

/* ── Products + marketplace ── */
app.use("/api/products",   marketRouter);
app.use("/api/shop",       marketDetailRouter);
app.use("/api/cart",       cartRouter);
app.use("/api/addproduct", addproductRouter);
app.use("/api/product",    productDetailRouter);

/* ── Messaging ── */
app.use("/api/messages/upload", uploadLimiter);
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
app.use("/api/addproduct", editproductRouter);
app.use("/api/promoteplans", promotePlansRouter);
app.use("/api/settings", settingsRouter);

/* ── Help & Support ─────────────────────────────────────────
   User-facing:  POST /api/support/tickets
                 GET  /api/support/tickets
                 GET  /api/support/tickets/:id
                 POST /api/support/tickets/:id/messages
                 POST /api/support/tickets/:id/reopen
                 POST /api/support/tickets/:id/rate
                 PATCH /api/support/tickets/:id
                 POST /api/support/reports
                 GET  /api/support/reports
                 POST /api/support/disputes
                 GET  /api/support/disputes
                 GET  /api/support/disputes/:id
                 POST /api/support/disputes/:id/messages
                 POST /api/support/appeals
                 GET  /api/support/appeals
                 POST /api/support/feedback
                 GET  /api/support/notifications
                 PATCH /api/support/notifications/:id/read
                 PATCH /api/support/notifications/read-all
                 GET  /api/support/faq/categories
                 GET  /api/support/faq/articles
                 GET  /api/support/faq/articles/:slug
                 POST /api/support/faq/articles/:id/helpful

   Admin-facing: All under /api/admin/support/*
                 Mounted inside adminRouter (routes/admin.js)
                 via router.use("/support", supportAdminRouter)
──────────────────────────────────────────────────────────────*/
app.use("/api/support", supportRouter);

/* ══════════════════════════════════════════════════════════════
   STATIC — sitemap + robots
══════════════════════════════════════════════════════════════ */
const PUBLIC_DIR = path.join(__dirname, "public");

app.get("/sitemap-index.xml", (_req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "sitemap-index.xml"))
);
app.get("/sitemap.xml", (_req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "sitemap-index.xml"))
);
app.get("/sitemaps/:file", (req, res) => {
  const safe = path.basename(req.params.file);
  res.sendFile(path.join(PUBLIC_DIR, "sitemaps", safe), (err) => {
    if (err) res.status(404).json({ success: false, message: "Sitemap not found" });
  });
});
app.get("/robots.txt", (_req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "robots.txt"))
);

/* ══════════════════════════════════════════════════════════════
   HEALTH
══════════════════════════════════════════════════════════════ */
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
    success      : true,
    status       : dbOk ? "healthy" : "degraded",
    timestamp    : new Date().toISOString(),
    database     : { ok: dbOk, latency_ms: dbLatency, error: dbError ?? undefined },
    process      : {
      uptime_s   : Math.floor(process.uptime()),
      memory_mb  : Math.round(process.memoryUsage().rss / 1_048_576),
      node       : process.version,
    },
    cache        : { size: _cache.size },
    online_users : getOnlineCount(),
  });
});

/* ══════════════════════════════════════════════════════════════
   SPA FALLBACK  — production only
══════════════════════════════════════════════════════════════ */
if (IS_PROD) {
  const dist = path.join(__dirname, "dist");
  app.use(express.static(dist, {
    maxAge     : "1d",
    setHeaders(res, fp) {
      if (/\.html?$/i.test(fp))
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    },
  }));

  /* API 404 — must come before the SPA catch-all */
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/"))
      return res.status(404).json({
        success : false,
        message : `Not found: ${req.method} ${req.path}`,
      });
    next();
  });

  /* SPA catch-all */
  app.get("*", (_req, res) =>
    res.sendFile(path.join(dist, "index.html"))
  );
}

/* ══════════════════════════════════════════════════════════════
   404  — development only
══════════════════════════════════════════════════════════════ */
app.use((req, res) =>
  res.status(404).json({
    success : false,
    message : `Cannot ${req.method} ${req.originalUrl}`,
  })
);

/* ══════════════════════════════════════════════════════════════
   GLOBAL ERROR HANDLER
══════════════════════════════════════════════════════════════ */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const reqId = req.requestId ?? "unknown";
  console.error(`🔥 [${reqId}] ${err.message}`);
  if (!IS_PROD) console.error(err.stack);

  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(400).json({ success: false, message: "File too large",              reqId });
  if (err.code === "LIMIT_FILE_COUNT")
    return res.status(400).json({ success: false, message: "Too many files",              reqId });
  if (err.code === "LIMIT_UNEXPECTED_FILE")
    return res.status(400).json({ success: false, message: "Unexpected file field",       reqId });
  if (err.message?.startsWith("CORS"))
    return res.status(403).json({ success: false, message: err.message,                   reqId });
  if (err.code === "23505")
    return res.status(409).json({ success: false, message: "Duplicate entry",             reqId });
  if (err.code === "23503")
    return res.status(400).json({ success: false, message: "Referenced record not found", reqId });
  if (err.code === "23514")
    return res.status(400).json({ success: false, message: "Constraint violated",         reqId });
  if (err.code === "22P02")
    return res.status(400).json({ success: false, message: "Invalid input format",        reqId });

  const status  = err.status ?? err.statusCode ?? 500;
  const message = IS_PROD && status === 500
    ? "Internal server error"
    : (err.message ?? "Internal server error");

  return res.status(status).json({ success: false, message, reqId });
});

/* ══════════════════════════════════════════════════════════════
   GRACEFUL SHUTDOWN
══════════════════════════════════════════════════════════════ */
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[server] ${signal} received — shutting down gracefully…`);
  clearInterval(_ev);

  const forceExit = setTimeout(() => {
    console.error("[server] forced exit after 15 s");
    process.exit(1);
  }, 15_000);
  forceExit.unref();

  server.close(async () => {
    try { io.close();       } catch { /* ignore */ }
    try { await pool.end(); } catch { /* ignore */ }
    clearTimeout(forceExit);
    console.log("[server] clean exit");
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

/* ══════════════════════════════════════════════════════════════
   START
══════════════════════════════════════════════════════════════ */
try {
  const { rows } = await pool.query("SELECT version()");
  console.log("✅ CockroachDB:", rows[0].version.split(" ")[0]);
} catch (err) {
  console.error("❌ DB connection failed:", err.message);
  process.exit(1);
}

startListingExpiryJob();
startCleanupJob();
initLeaderboardCron();

server.listen(PORT, () => {
  console.log(`\n🚀 Loemart on port ${PORT} | ${process.env.NODE_ENV || "development"}`);
  console.log(`   Auth             → /api/auth`);
  console.log(`   Support (user)   → /api/support`);
  console.log(`                        POST /tickets`);
  console.log(`                        GET  /tickets`);
  console.log(`                        GET  /tickets/:id`);
  console.log(`                        POST /tickets/:id/messages`);
  console.log(`                        POST /tickets/:id/reopen`);
  console.log(`                        POST /tickets/:id/rate`);
  console.log(`                        PATCH /tickets/:id`);
  console.log(`                        POST /reports`);
  console.log(`                        POST /disputes`);
  console.log(`                        POST /appeals`);
  console.log(`                        POST /feedback`);
  console.log(`                        GET  /faq/categories`);
  console.log(`                        GET  /faq/articles`);
  console.log(`   Support (admin)  → /api/admin/support`);
  console.log(`                        GET  /tickets`);
  console.log(`                        PATCH /tickets/:id`);
  console.log(`                        POST /tickets/:id/reply`);
  console.log(`                        POST /tickets/:id/escalate`);
  console.log(`                        GET  /analytics\n`);
});

export default app;