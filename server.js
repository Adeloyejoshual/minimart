// server.js
import express           from "express";
import cors              from "cors";
import path              from "path";
import http              from "http";
import dotenv            from "dotenv";
import { fileURLToPath } from "url";
import { Pool }          from "pg";

import { initSocket, getOnlineCount }    from "./socket.js";
import { startJobRunner, stopJobRunner } from "./jobs/jobRunner.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const PORT           = process.env.PORT          || 5000;
const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || "*";
const APP_URL        = process.env.APP_URL        || "https://loemart.com";

/* ═══════════════════════════════════════════════════════════════
   APP + HTTP SERVER
═══════════════════════════════════════════════════════════════ */
const app    = express();
const server = http.createServer(app);

/* ═══════════════════════════════════════════════════════════════
   ⚡ STATIC FILES — MUST BE FIRST
   Serve before CORS/auth so assets are never blocked.
   /assets/* files have content-hash names so cache 1 year.
═══════════════════════════════════════════════════════════════ */
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "dist");

  // ── Hashed asset files — cache aggressively ──
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      maxAge      : "365d",
      etag        : true,
      lastModified: true,
      immutable   : true,
      setHeaders(res) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    })
  );

  // ── Other public files (favicon, manifest, robots, etc.) ──
  app.use(
    express.static(distPath, {
      maxAge      : "1d",
      etag        : true,
      lastModified: true,
      index       : false,
    })
  );
}

/* ═══════════════════════════════════════════════════════════════
   WWW → NON-WWW REDIRECT  ⚡ MUST be before CORS
   Redirects https://www.loemart.com → https://loemart.com
   This permanently fixes the CORS issue at the source.
   301 = permanent redirect (browsers + Google cache this).
═══════════════════════════════════════════════════════════════ */
app.use((req, res, next) => {
  const host = req.headers.host || "";

  if (host.startsWith("www.")) {
    const canonical = host.replace(/^www\./, "");
    const newUrl    = `https://${canonical}${req.originalUrl}`;
    console.log(`[www→] ${host}${req.originalUrl} → ${newUrl}`);
    return res.redirect(301, newUrl);
  }

  next();
});

/* ═══════════════════════════════════════════════════════════════
   DATABASE
═══════════════════════════════════════════════════════════════ */
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
    console.log("✅ CockroachDB:", rows[0].version.split(" ")[0]);
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  }
})();

pool.on("error", (err) =>
  console.error("🔥 Unexpected pool error:", err.message)
);

/* ═══════════════════════════════════════════════════════════════
   SOCKET.IO
═══════════════════════════════════════════════════════════════ */
export const io = initSocket(server, ALLOWED_ORIGIN);

/* ═══════════════════════════════════════════════════════════════
   IN-MEMORY CACHE (TTL-based)
═══════════════════════════════════════════════════════════════ */
const _cache    = new Map();
const CACHE_TTL = 60_000;

export const setCache = (key, value, ttl = CACHE_TTL) =>
  _cache.set(key, { value, expires: Date.now() + ttl });

export const getCache = (key) => {
  const item = _cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) { _cache.delete(key); return null; }
  return item.value;
};

export const deleteCache       = (key)    => _cache.delete(key);
export const clearCachePattern = (prefix) => {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
};

setInterval(() => {
  const now = Date.now();
  for (const [key, item] of _cache.entries()) {
    if (now > item.expires) _cache.delete(key);
  }
}, 60_000);

/* ═══════════════════════════════════════════════════════════════
   CORS
   Always allows loemart.com + www.loemart.com + localhost.
   www is also handled by the redirect above, but we keep it
   here as a safety net for direct API calls.
═══════════════════════════════════════════════════════════════ */
const ALWAYS_ALLOWED = [
  "https://loemart.com",
  "https://www.loemart.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
];

const corsOptions = {
  origin(origin, cb) {
    // No origin = mobile / curl / same-origin request
    if (!origin) return cb(null, true);

    // Wildcard = allow all
    if (ALLOWED_ORIGIN === "*") return cb(null, true);

    // Build combined allowed list from env + hardcoded
    const fromEnv = ALLOWED_ORIGIN
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const allowed = [...new Set([...fromEnv, ...ALWAYS_ALLOWED])];

    if (allowed.includes(origin)) return cb(null, true);

    console.warn(`[CORS] Blocked: ${origin}`);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials    : true,
  methods        : ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders : ["Content-Type", "Authorization", "x-requested-with"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ═══════════════════════════════════════════════════════════════
   SECURITY HEADERS
═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   STATIC — uploads folder
═══════════════════════════════════════════════════════════════ */
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge      : "7d",
    etag        : true,
    lastModified: true,
    setHeaders(res, filePath) {
      if (/\.html?$/.test(filePath)) {
        res.setHeader("Content-Type", "text/plain");
      }
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
   SEO — DYNAMIC SITEMAP (product pages)
═══════════════════════════════════════════════════════════════ */
const SITEMAP_CACHE_TTL = 60 * 60 * 1_000; // 1 hour
let   sitemapCache      = null;
let   sitemapCachedAt   = 0;

app.get("/sitemap-products.xml", async (_req, res) => {
  try {
    if (sitemapCache && Date.now() - sitemapCachedAt < SITEMAP_CACHE_TTL) {
      res.setHeader("Content-Type",  "application/xml");
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.send(sitemapCache);
    }

    const { rows } = await pool.query(`
      SELECT slug, updated_at
      FROM   market.products
      WHERE  status = 'active'
      ORDER  BY updated_at DESC
      LIMIT  5000
    `);

    const today = new Date().toISOString().split("T")[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    for (const row of rows) {
      const lastmod = row.updated_at
        ? new Date(row.updated_at).toISOString().split("T")[0]
        : today;
      xml += `  <url>
    <loc>${APP_URL}/product/${row.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>\n`;
    }

    xml += `</urlset>`;
    sitemapCache    = xml;
    sitemapCachedAt = Date.now();

    res.setHeader("Content-Type",  "application/xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(xml);

  } catch (err) {
    console.error("❌ Sitemap error:", err.message);
    return res.status(500).send("Error generating sitemap");
  }
});

/* ═══════════════════════════════════════════════════════════════
   SEO — SITEMAP INDEX
═══════════════════════════════════════════════════════════════ */
app.get("/sitemap-index.xml", (_req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const xml   = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${APP_URL}/sitemap.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${APP_URL}/sitemap-products.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;

  res.setHeader("Content-Type",  "application/xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.send(xml);
});

/* ═══════════════════════════════════════════════════════════════
   SEO — DYNAMIC ROBOTS.TXT
═══════════════════════════════════════════════════════════════ */
app.get("/robots.txt", (_req, res) => {
  const txt = `# Loemart — robots.txt
User-agent: *
Allow: /
Allow: /minimart
Allow: /search
Allow: /deals
Allow: /trending
Allow: /latest
Allow: /nearby
Allow: /p2p
Allow: /product/
Allow: /seller/
Allow: /become-seller
Allow: /terms
Allow: /faq
Allow: /support

Disallow: /admin/
Disallow: /api/
Disallow: /profile
Disallow: /wallet
Disallow: /settings
Disallow: /notifications
Disallow: /conversations
Disallow: /chat/
Disallow: /dashboard
Disallow: /shop/checkout
Disallow: /shop/orders/
Disallow: /payment/

User-agent: AhrefsBot
Disallow: /

User-agent: SemrushBot
Disallow: /

User-agent: MJ12bot
Disallow: /

Sitemap: ${APP_URL}/sitemap.xml
Sitemap: ${APP_URL}/sitemap-products.xml

Crawl-delay: 10
`;

  res.setHeader("Content-Type",  "text/plain");
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.send(txt);
});

/* ═══════════════════════════════════════════════════════════════
   WEBHOOKS  ⚠️  MUST be before express.json()
═══════════════════════════════════════════════════════════════ */
import paymentRouter, { webhookRouter } from "./routes/payment.js";
import flwWebhookRouter                 from "./routes/webhooks/flutterwave.js";
import checkoutWebhookRouter            from "./routes/checkout/webhook.js";
import checkoutRouter                   from "./routes/checkout/index.js";

app.use(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  webhookRouter
);

app.use(
  "/api/webhooks/flutterwave",
  express.raw({ type: "application/json" }),
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

    console.log("═══════════════════════════════════════════════");
    console.log("  FLW CAPTURE  —", new Date().toISOString());
    console.log("  verif-hash  :", req.headers["verif-hash"]);
    console.log("  event       :", body?.event);
    console.log("  amount      :", body?.data?.amount);
    console.log("  status      :", body?.data?.status);
    console.log("═══════════════════════════════════════════════");

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
    } catch { /* safe */ }

    res.status(200).json({ captured: true, event: body?.event });
  }
);

app.use(
  "/api/checkout/webhook/payment",
  express.raw({ type: "application/json" }),
  checkoutWebhookRouter
);

/* ═══════════════════════════════════════════════════════════════
   BODY PARSERS  ⚠️  After webhooks
═══════════════════════════════════════════════════════════════ */
app.use(express.json({       limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ═══════════════════════════════════════════════════════════════
   REQUEST LOGGER
═══════════════════════════════════════════════════════════════ */
if (process.env.NODE_ENV !== "test") {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.originalUrl}`);
    next();
  });
}

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITER
═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   CRON JOBS
═══════════════════════════════════════════════════════════════ */
import "./jobs/expirePromotions.js";

/* ═══════════════════════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════════════════════ */
app.use("/api/payment",          paymentRouter);
app.use("/api/checkout",         checkoutRouter);

import authRouter             from "./routes/sellerAuth.routes.js";
import sellerOnboardingRouter from "./routes/sellerOnboarding.routes.js";
app.use("/api/auth",              authRouter);
app.use("/api/seller-onboarding", sellerOnboardingRouter);

import sellerProfileRouter   from "./routes/sellerprofile.js";
import sellerPayoutRoutes    from "./routes/seller/payout.js";
import sellerDashboardRouter from "./routes/seller/dashboard.js";
import sellerSettingsRouter  from "./routes/seller/settings.js";
app.use("/api/seller",           sellerProfileRouter);
app.use("/api/seller/payout",    sellerPayoutRoutes);
app.use("/api/seller-dashboard", sellerDashboardRouter);
app.use("/api/seller/settings",  sellerSettingsRouter);

import marketRouter from "./routes/market/index.js";
app.use("/api/products", marketRouter);

import marketDetailRouter from "./routes/marketDetail/index.js";
app.use("/api/shop", marketDetailRouter);

import cartRouter from "./routes/cart/index.js";
app.use("/api/cart", cartRouter);

import addproductRouter    from "./routes/addproduct.js";
import productDetailRouter from "./routes/productDetail.js";
app.use("/api/addproduct", addproductRouter);
app.use("/api/product",    productDetailRouter);

import userRouter from "./routes/users.js";
app.use("/api/users", userRouter);

import messagesRouter      from "./routes/messages.js";
import conversationsRouter from "./routes/conversations.js";
app.use("/api/messages/upload", rateLimiter(UPLOAD_MAX));
app.use("/api/messages",        messagesRouter);
app.use("/api/conversations",   conversationsRouter);

import adminRouter from "./routes/admin.js";
app.use("/api/admin", adminRouter);

import searchRouter from "./routes/search.js";
app.use("/api/search", searchRouter);

import homepageRouter from "./routes/homepage.js";
app.use("/api/homepage", homepageRouter);

import dashboardRoutes from "./routes/dashboard.js";
app.use("/api/dashboard", dashboardRoutes);

import notificationsRouter from "./routes/notifications.js";
app.use("/api/notifications", notificationsRouter);

import walletRoutes from "./routes/wallets.js";
app.use("/api/v1/wallets", walletRoutes);

import p2pRouter from "./routes/p2p.js";
app.use("/api/p2p", p2pRouter);

import verificationRouter from "./routes/verification.js";
app.use("/api/verification", verificationRouter);

/* ═══════════════════════════════════════════════════════════════
   HEALTH CHECK
═══════════════════════════════════════════════════════════════ */
app.get("/api/health", async (_req, res) => {
  let dbOk      = false;
  let dbLatency = null;
  let dbError   = null;

  try {
    const t0       = Date.now();
    const { rows } = await pool.query("SELECT 1 AS ok");
    dbLatency      = Date.now() - t0;
    dbOk           = rows[0]?.ok == 1;
  } catch (err) {
    dbError = err.message;
  }

  const mode = flwKeyMode();

  return res.json({
    success        : true,
    status         : dbOk ? "healthy" : "degraded",
    database       : dbOk,
    db_latency_ms  : dbLatency,
    db_error       : dbError ?? undefined,
    uptime_s       : Math.floor(process.uptime()),
    memory_mb      : Math.round(process.memoryUsage().rss / 1024 / 1024),
    online_users   : getOnlineCount(),
    node_version   : process.version,
    env            : process.env.NODE_ENV || "development",
    flw_key_set    : !!process.env.FLW_SECRET_KEY,
    flw_hash_set   : !!process.env.FLW_SECRET_HASH,
    flw_mode       : mode,
    flw_key_prefix : process.env.FLW_SECRET_KEY
      ? process.env.FLW_SECRET_KEY.slice(0, 14) + "…"
      : null,
    webhook_url    : `${APP_URL}/api/webhooks/flutterwave`,
    sitemap_url    : `${APP_URL}/sitemap-products.xml`,
  });
});

/* ═══════════════════════════════════════════════════════════════
   SPA CATCH-ALL — production only
   Serves index.html for all non-API routes.
   ⚠️  MUST come after all API routes.
═══════════════════════════════════════════════════════════════ */
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "dist");

  app.get("*", (req, res) => {
    // Block API routes from falling through
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({
        success : false,
        message : `API route not found: ${req.method} ${req.originalUrl}`,
      });
    }
    // Serve React SPA for all other routes
    res.sendFile(path.join(distPath, "index.html"));
  });
}

/* ═══════════════════════════════════════════════════════════════
   404
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
      : (err.message ?? "Internal server error");

  return res.status(status).json({ success: false, message });
});

/* ═══════════════════════════════════════════════════════════════
   GRACEFUL SHUTDOWN
═══════════════════════════════════════════════════════════════ */
async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully…`);
  stopJobRunner();
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

/* ═══════════════════════════════════════════════════════════════
   START
═══════════════════════════════════════════════════════════════ */
server.listen(PORT, () => {
  const mode = flwKeyMode();

  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`   ENV       : ${process.env.NODE_ENV || "development"}`);
  console.log(`   APP URL   : ${APP_URL}`);
  console.log(`   CORS      : ${ALLOWED_ORIGIN}`);
  console.log(`   FLW KEY   : ${
    mode === "missing" ? "❌ MISSING"   :
    mode === "live"    ? "✅ LIVE MODE" :
                         "⚠️  TEST MODE"
  }`);
  console.log(`   FLW HASH  : ${
    process.env.FLW_SECRET_HASH ? "✅ set" : "❌ MISSING — webhooks rejected"
  }`);
  console.log(`   PRODUCTS  : /api/products`);
  console.log(`   SHOP      : /api/shop`);
  console.log(`   CART      : /api/cart`);
  console.log(`   CHECKOUT  : /api/checkout`);
  console.log(`   WEBHOOK   : ${APP_URL}/api/webhooks/flutterwave`);
  console.log(`   SITEMAP   : ${APP_URL}/sitemap-products.xml`);
  console.log(`   ROBOTS    : ${APP_URL}/robots.txt`);
  console.log(`   WWW→      : www.loemart.com → loemart.com (301)`);

  startJobRunner();
  console.log("🧹 Background jobs started");
});

export default app;