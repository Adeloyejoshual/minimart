import express            from "express";
import cors               from "cors";
import path               from "path";
import http               from "http";
import dotenv             from "dotenv";
import { fileURLToPath }  from "url";
import { Server as SocketIOServer } from "socket.io";
import { Pool }           from "pg";

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
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  },
});

/* =========================================
   DATABASE
   Exported so all route files share one pool.
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
   IN-MEMORY PRESENCE
   userId → Set of socketIds (multi-tab safe)
   Replace with Redis at 1M+ users.
========================================= */
const onlineUsers = new Map(); // userId → Set<socketId>

const userOnline = (userId, socketId) => {
  const s = onlineUsers.get(String(userId)) || new Set();
  s.add(socketId);
  onlineUsers.set(String(userId), s);
  // Write to DB only on first connection (not every tab)
  if (s.size === 1) {
    pool.query(
      `UPDATE users SET is_online = true WHERE id = $1`,
      [userId]
    ).catch(() => {});
  }
};

const userOffline = (userId, socketId) => {
  const s = onlineUsers.get(String(userId));
  if (!s) return;
  s.delete(socketId);
  if (s.size === 0) {
    onlineUsers.delete(String(userId));
    // Only mark offline when ALL tabs/devices disconnect
    pool.query(
      `UPDATE users SET is_online = false WHERE id = $1`,
      [userId]
    ).catch(() => {});
  }
};

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
   PAYSTACK WEBHOOK
   MUST come before express.json()
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
      online_users: onlineUsers.size,
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
   SOCKET.IO
========================================= */
io.on("connection", (socket) => {
  // userId passed from frontend: io(URL, { query: { userId } })
  const userId = socket.handshake.query.userId || null;

  if (userId) {
    userOnline(userId, socket.id);
    console.log(`🔌 Connected: ${socket.id} | user: ${userId}`);
  } else {
    console.log(`🔌 Connected: ${socket.id} | guest`);
  }

  /* ── Join thread room ── */
  socket.on("joinThread", ({ threadId, userId: uid }) => {
    if (!threadId || !uid) return;
    socket.join(threadId);
    console.log(`📦 ${uid} joined thread: ${threadId}`);

    // Mark other person's messages as delivered
    pool.query(
      `UPDATE chat_messages
       SET status = 'delivered'
       WHERE thread_id = $1
         AND sender_id != $2
         AND status = 'sent'
         AND deleted = false`,
      [threadId, uid]
    ).catch(() => {});
  });

  /* ── Relay saved message to the other person ──
     Frontend saves via HTTP POST first, then emits
     the returned DB row here. No double-save. */
  socket.on("sendMessage", (msg) => {
    if (!msg?.thread_id) return;
    socket.to(msg.thread_id).emit("receiveMessage", msg);
  });

  /* ── Typing indicators ── */
  socket.on("typing", ({ threadId, userId: uid }) => {
    if (!threadId) return;
    socket.to(threadId).emit("userTyping", { userId: uid });
  });

  socket.on("stopTyping", ({ threadId, userId: uid }) => {
    if (!threadId) return;
    socket.to(threadId).emit("userStopTyping", { userId: uid });
  });

  /* ── Read receipts ── */
  socket.on("markRead", ({ threadId, userId: uid }) => {
    if (!threadId || !uid) return;

    // Mark messages as read in DB
    pool.query(
      `UPDATE chat_messages
       SET status = 'read'
       WHERE thread_id = $1
         AND sender_id != $2
         AND status != 'read'
         AND deleted = false`,
      [threadId, uid]
    ).then(() => {
      // Reset precomputed unread counter for this user
      pool.query(
        `UPDATE chat_threads
         SET
           unread_buyer  = CASE WHEN buyer_id  = $2 THEN 0 ELSE unread_buyer  END,
           unread_seller = CASE WHEN seller_id = $2 THEN 0 ELSE unread_seller END
         WHERE id = $1`,
        [threadId, uid]
      ).catch(() => {});
    }).catch(() => {});

    // Tell the sender their messages were read (blue ticks)
    socket.to(threadId).emit("messagesRead", { threadId, userId: uid });
  });

  /* ── Presence — clean up on disconnect ── */
  socket.on("disconnect", () => {
    if (userId) {
      userOffline(userId, socket.id);
      console.log(`❌ Disconnected: ${socket.id} | user: ${userId}`);
    } else {
      console.log(`❌ Disconnected: ${socket.id} | guest`);
    }
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