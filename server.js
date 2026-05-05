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
   Exported so all route files share one pool
   and don't create their own connections.
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

// Evict stale buckets every 5 minutes — prevents unbounded Map growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of _limiter.entries()) {
    if (now - data.time > WINDOW_MS) _limiter.delete(ip);
  }
}, 5 * 60_000);

app.use((req, res, next) => {
  // x-forwarded-for may be comma-separated when behind multiple proxies
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
   PAYSTACK WEBHOOK
   MUST come before express.json() — the webhook
   handler needs the raw Buffer, not a parsed body.
========================================= */
import paymentRouter, { webhookRouter } from "./routes/payment.js";

app.use(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  webhookRouter
);

/* =========================================
   BODY PARSERS
   Registered AFTER the raw webhook and BEFORE
   any route that reads req.body.
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
   More-specific prefixes first — Express matches
   the first prefix that fits, so /api/marketplace/sellers
   must come before /api/marketplace.
========================================= */
import addproductRouter   from "./routes/addproduct.js";
import userRouter          from "./routes/users.js";
import messagesRouter      from "./routes/messages.js";
import adminRouter         from "./routes/admin.js";
import searchRouter        from "./routes/search.js";
import productDetailRouter from "./routes/productDetail.js";
import homepageRouter      from "./routes/homepage.js";
import sellerProfileRouter from "./routes/sellerprofile.js";
import dashboardRoutes from "./routes/dashboard.js";

app.use("/api/seller", sellerProfileRouter); // ← more specific first
app.use("/api/addproduct",         addproductRouter);
app.use("/api/users",               userRouter);
app.use("/api/messages",            messagesRouter);
app.use("/api/admin",               adminRouter);
app.use("/api/search",              searchRouter);
app.use("/api/product",             productDetailRouter);
app.use("/api/homepage", 
homepageRouter);
app.use("/api/dashboard", 
dashboardRoutes);

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

  // SPA catch-all: serve index.html for every non-API route
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
   404 — unmatched routes
   Must come after all app.use() routes and
   before the error handler.
========================================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

/* =========================================
   GLOBAL ERROR HANDLER
   Must be the absolute last middleware.
   Four parameters required — Express uses
   the arity to identify error handlers.
   Always returns JSON — never the default
   HTML error page that causes the client's
   "Unexpected token '<'" crash.
========================================= */
app.use((err, req, res, _next) => {
  console.error("🔥 Unhandled error:", err);

  // Multer validation errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ success: false, message: "File too large (max 3 MB)" });
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

  const status = err.status ?? err.statusCode ?? 500;

  // Never expose internal messages in production
  const message =
    process.env.NODE_ENV === "production" && status === 500
      ? "Internal server error"
      : (err.message ?? "Internal server error");

  res.status(status).json({ success: false, message });
});

/* =========================================
   SOCKET.IO
========================================= */
io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  socket.on("joinRoom", ({ senderId, receiverId, productId }) => {
    if (!senderId || !receiverId || !productId) return;
    const room = `${productId}_${[senderId, receiverId].sort().join("_")}`;
    socket.join(room);
  });

  socket.on("sendMessage", async ({ senderId, receiverId, productId, message } = {}) => {
    if (!senderId || !receiverId || !productId || !message) return;

    try {
      const room = `${productId}_${[senderId, receiverId].sort().join("_")}`;
      const { rows } = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, product_id, message, created_at)
         VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
        [senderId, receiverId, productId, message]
      );
      io.to(room).emit("receiveMessage", rows[0]);
    } catch (err) {
      console.error("Socket message error:", err.message);
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
