// server.js
import express from "express";
import cors from "cors";
import path from "path";
import http from "http";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { Server as SocketIOServer } from "socket.io";
import { Pool } from "pg";

dotenv.config();

/* =========================================
   APP + SERVER
========================================= */
const app = express();
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

/* =========================================
   DATABASE
========================================= */
export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: {
    rejectUnauthorized: false,
  },
});

/* =========================================
   TEST DATABASE
========================================= */
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Database connected");
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    process.exit(1);
  }
})();

/* =========================================
   SIMPLE CACHE
========================================= */
export const cache = new Map();

const CACHE_TTL = 60 * 1000; // 1 min

const setCache = (key, value) => {
  cache.set(key, {
    value,
    time: Date.now(),
  });
};

const getCache = (key) => {
  const item = cache.get(key);

  if (!item) return null;

  if (Date.now() - item.time > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return item.value;
};

setInterval(() => {
  const now = Date.now();

  for (const [key, value] of cache.entries()) {
    if (now - value.time > CACHE_TTL) {
      cache.delete(key);
    }
  }
}, 60000);

/* =========================================
   MIDDLEWARE
========================================= */
app.use(cors());

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

/* =========================================
   REQUEST LOGGER
========================================= */
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} | ${req.method} ${req.originalUrl}`
  );
  next();
});

/* =========================================
   RATE LIMITER
========================================= */
const limiter = new Map();
const WINDOW_MS = 2000;
const MAX_REQ = 60;

app.use((req, res, next) => {
  const ip =
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    "unknown";

  const now = Date.now();

  let data = limiter.get(ip);

  if (!data || now - data.time > WINDOW_MS) {
    data = {
      count: 1,
      time: now,
    };
  } else {
    data.count++;
  }

  limiter.set(ip, data);

  if (data.count > MAX_REQ) {
    return res.status(429).json({
      success: false,
      message: "Too many requests",
    });
  }

  next();
});

/* =========================================
   PAYSTACK WEBHOOK
========================================= */
import paymentRouter, {
  webhookRouter,
} from "./routes/payment.js";

/* raw body only for webhook */
app.use(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  webhookRouter
);

/* json routes */
app.use("/api/payment", paymentRouter);

/* =========================================
   BODY PARSER
========================================= */
app.use(express.json({ limit: "10mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

/* =========================================
   CRON JOBS
========================================= */
import "./jobs/expirePromotions.js";

/* =========================================
   ROUTES
========================================= */
import marketplaceRouter from "./routes/addproduct.js";
import userRouter from "./routes/users.js";
import messagesRouter from "./routes/messages.js";
import adminRouter from "./routes/admin.js";
import searchRouter from "./routes/search.js";
import productDetailRouter from "./routes/productDetail.js";
import homepageRouter from "./routes/homepage.js";
import sellerProfileRouter from "./routes/sellerprofile.js";

app.use("/api/marketplace", marketplaceRouter);
app.use("/api/users", userRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/search", searchRouter);
app.use("/api/product", productDetailRouter);
app.use("/api", homepageRouter);
app.use("/api/marketplace/sellers", sellerProfileRouter);

/* =========================================
   HEALTH CHECK
========================================= */
app.get("/api/health", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT 1");

    return res.json({
      success: true,
      database: rows.length > 0,
      uptime: process.uptime(),
      memory: process.memoryUsage().rss,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/* =========================================
   SOCKET.IO
========================================= */
io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  socket.on(
    "joinRoom",
    ({ senderId, receiverId, productId }) => {
      if (!senderId || !receiverId || !productId) return;

      const room = `${productId}_${[senderId, receiverId]
        .sort()
        .join("_")}`;

      socket.join(room);
    }
  );

  socket.on("sendMessage", async (data) => {
    try {
      const {
        senderId,
        receiverId,
        productId,
        message,
      } = data;

      if (
        !senderId ||
        !receiverId ||
        !productId ||
        !message
      ) {
        return;
      }

      const room = `${productId}_${[
        senderId,
        receiverId,
      ]
        .sort()
        .join("_")}`;

      const { rows } = await pool.query(
        `
        INSERT INTO messages
        (
          sender_id,
          receiver_id,
          product_id,
          message,
          created_at
        )
        VALUES ($1,$2,$3,$4,NOW())
        RETURNING *
        `,
        [senderId, receiverId, productId, message]
      );

      io.to(room).emit("receiveMessage", rows[0]);
    } catch (error) {
      console.error(
        "❌ Socket message error:",
        error.message
      );
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

/* =========================================
   STATIC FILES
========================================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "dist");

  app.use(express.static(distPath));

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({
        success: false,
        message: "API route not found",
      });
    }

    res.sendFile(path.join(distPath, "index.html"));
  });
}

/* =========================================
   GLOBAL ERROR HANDLER
========================================= */
app.use((err, req, res, next) => {
  console.error("🔥 Server error:", err);

  return res.status(500).json({
    success: false,
    message:
      err.message || "Internal Server Error",
  });
});

/* =========================================
   START SERVER
========================================= */
server.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});

export { io, setCache, getCache };
export default app;