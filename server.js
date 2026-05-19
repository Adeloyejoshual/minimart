import express            from "express";
import cors               from "cors";
import path               from "path";
import http               from "http";
import dotenv             from "dotenv";
import { fileURLToPath }  from "url";
import { Pool }           from "pg";
import { initSocket, getOnlineCount } from "./socket.js";

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
   SOCKET.IO — init with server
========================================= */
const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || "*";
export const io = initSocket(server, ALLOWED_ORIGIN);

/* =========================================
   IN-MEMORY CACHE
========================================= */
const _cache    = new Map();
const CACHE_TTL = 60 * 1000;

export const setCache = (key, value) => {
  _cache.set(key, { value, time: Date.now() });
};

export const getCache = (key) => {
  const item = _cache.get(key);
  if (!item) return null;
  if (Date.now() - item.time > CACHE_TTL) {
    _cache.delete(key);
    return null;
  }
  return item.value;
};

setInterval(() => {
  const now = Date.now();
  for (const [key, item] of _cache.entries()) {
    if (now - item.time > CACHE_TTL) _cache.delete(key);
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
const _limiter  = new Map();
const WINDOW_MS = 60_000;
const MAX_REQ   = 120;

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of _limiter.entries()) {
    if (now - data.time > WINDOW_MS) _limiter.delete(ip);
  }
}, 5 * 60_000);

app.use((req, res, next) => {
  const ip  = req.headers["x-forwarded-for"]?.split(",")[0].trim()
              ?? req.socket.remoteAddress
              ?? "unknown";
  const now = Date.now();
  let data  = _limiter.get(ip);

  if (!data || now - data.time > WINDOW_MS) {
    data = { count: 1, time: now };
  } else {
    data.count++;
  }

  _limiter.set(ip, data);

  if (data.count > MAX_REQ) {
    return res.status(429).json({ success: false, message: "Too many requests" });
  }

  next();
});

/* =========================================
   PAYSTACK WEBHOOK — before express.json()
========================================= */
import paymentRouter, { webhookRouter } from "./routes/payment.js";

app.use(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  webhookRouter
);

/* =========================================
   BODY PARSERS
========================================= */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* =========================================
   PAYMENT ROUTES
========================================= */
app.use("/api/payment", paymentRouter);

/* =========================================
   CRON JOBS
========================================= */
import "./jobs/expirePromotions.js";

/* =========================================
   API ROUTES
========================================= */
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
import postAdsRouter from "./routes/postAds.js";
const walletRoutes from "./routes/wallets.js";
import p2pRouter from "./routes/p2p.js";

app.use("/api/seller",        sellerProfileRouter);
app.use("/api/addproduct",    addproductRouter);
app.use("/api/users",         userRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/messages",      messagesRouter);
app.use("/api/admin",         adminRouter);
app.use("/api/search",        searchRouter);
app.use("/api/product",       productDetailRouter);
app.use("/api/homepage",      homepageRouter);
app.use("/api/dashboard",     dashboardRoutes);
app.use("/api/notifications", notificationsRouter);
app.use("/api/products",       postAdsRouter);
app.use("/api/v1/wallets",      walletRoutes);
app.use("/api/p2p", p2pRouter);
/* =========================================
   HEALTH CHECK
========================================= */
app.get("/api/health", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT 1");
    return res.json({
      success:      true,
      database:     rows.length > 0,
      uptime:       process.uptime(),
      memory:       process.memoryUsage().rss,
      online_users: getOnlineCount(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================
   STATIC FILES (production only)
========================================= */
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "dist");
  app.use(express.static(distPath));

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
   404
========================================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

/* =========================================
   GLOBAL ERROR HANDLER
========================================= */
app.use((err, req, res, _next) => {
  console.error("🔥 Unhandled error:", err);

  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(400).json({ success: false, message: "File too large (max 3 MB)" });
  if (err.code === "LIMIT_FILE_COUNT")
    return res.status(400).json({ success: false, message: "Too many files (max 6)" });
  if (err.code === "LIMIT_UNEXPECTED_FILE")
    return res.status(400).json({ success: false, message: "Unexpected file field" });
  if (err.message === "Only images allowed")
    return res.status(400).json({ success: false, message: err.message });

  const status  = err.status ?? err.statusCode ?? 500;
  const message = process.env.NODE_ENV === "production" && status === 500
    ? "Internal server error"
    : (err.message ?? "Internal server error");

  res.status(status).json({ success: false, message });
});

/* =========================================
   START
========================================= */
server.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});

export default app;