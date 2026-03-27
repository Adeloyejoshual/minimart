import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";

import marketplaceRouter from "./routes/marketplace.js";
import userRouter from "./routes/users.js";
import messagesRouter from "./routes/messages.js";
import adminRouter from "./routes/admin.js";
import searchRouter from "./routes/search.js"; // 🔥 ADDED

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: "*" } });

/* ================= DB ================= */
export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

pool.connect()
  .then(() => console.log("✅ Connected to CockroachDB"))
  .catch(err => console.error("❌ DB error:", err.message));

/* ================= BASIC CACHE (SEARCH BOOST) ================= */
const cache = new Map();
const CACHE_TTL = 60 * 1000;

const setCache = (key, value) => {
  cache.set(key, { value, time: Date.now() });
};

const getCache = (key) => {
  const data = cache.get(key);
  if (!data) return null;
  if (Date.now() - data.time > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return data.value;
};

/* ================= MIDDLEWARES ================= */
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ================= REQUEST LOGGER (ANALYTICS BASE) ================= */
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

/* ================= SIMPLE RATE LIMIT ================= */
const rateLimitMap = new Map();

app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();

  const record = rateLimitMap.get(ip) || { count: 0, time: now };

  if (now - record.time < 1000) {
    record.count += 1;
  } else {
    record.count = 1;
    record.time = now;
  }

  rateLimitMap.set(ip, record);

  if (record.count > 60) {
    return res.status(429).json({ message: "Too many requests" });
  }

  next();
});

/* ================= ROUTES ================= */
app.use("/api/marketplace", marketplaceRouter);
app.use("/api/users", userRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/search", searchRouter); // 🔥 ADDED

/* ================= HEALTH CHECK ================= */
app.get("/api/health", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT 1 as status");
    res.json({
      success: true,
      db: rows[0].status === 1,
      uptime: process.uptime(),
      memory: process.memoryUsage().rss,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ================= SOCKET.IO ================= */
io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  socket.on("joinRoom", ({ senderId, receiverId, productId }) => {
    const room = `${productId}_${[senderId, receiverId].sort().join("_")}`;
    socket.join(room);
  });

  socket.on("sendMessage", async (data) => {
    const { senderId, receiverId, productId, message } = data;

    const room = `${productId}_${[senderId, receiverId].sort().join("_")}`;

    try {
      const { rows } = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, product_id, message, created_at)
         VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
        [senderId, receiverId, productId, message]
      );

      io.to(room).emit("receiveMessage", rows[0]);
    } catch (err) {
      console.error("Socket error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

/* ================= SPA ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ message: "API not found" });
    }

    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

/* ================= GLOBAL ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
});

/* ================= START ================= */
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;