// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import dotenv from "dotenv";
import http from "http";

import marketplaceRouter from "./routes/marketplace.js";
import userRouter from "./routes/users.js";
import messagesRouter from "./routes/messages.js";
import adminRouter from "./routes/admin.js"; // ✅ Admin API router

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// -------------------
// HTTP Server (for Socket.io)
// -------------------
const server = http.createServer(app);

// -------------------
// CockroachDB Pool
// -------------------
export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

pool.connect()
  .then(() => console.log("✅ Connected to CockroachDB"))
  .catch((err) => console.error("❌ CockroachDB connection error:", err.message));

// -------------------
// Middlewares
// -------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------
// API Routes
// -------------------
app.use("/api/marketplace", marketplaceRouter);
app.use("/api/users", userRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/admin", adminRouter); // ✅ Admin API routes

// -------------------
// Serve React Build in Production
// -------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === "production") {
  // Main marketplace frontend
  app.use(express.static(path.join(__dirname, "dist")));

  // Optional: separate admin frontend
  // app.use("/admin", express.static(path.join(__dirname, "admin_dist")));

  // Catch-all for SPA routing
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ success: false, message: "API endpoint not found" });
    }
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

// -------------------
// Root / Health Check
// -------------------
app.get("/api/health", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT 1 as status");
    res.json({ success: true, db: rows[0].status === 1 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------
// Socket.io Setup
// -------------------
import { Server as SocketIOServer } from "socket.io";
const io = new SocketIOServer(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("joinRoom", ({ senderId, receiverId, productId }) => {
    const room = `${productId}_${[senderId, receiverId].sort().join("_")}`;
    socket.join(room);
    console.log(`👥 User ${senderId} joined room ${room}`);
  });

  socket.on("sendMessage", async ({ senderId, receiverId, productId, message }) => {
    const room = `${productId}_${[senderId, receiverId].sort().join("_")}`;
    try {
      const { rows } = await pool.query(
        `INSERT INTO public.messages (sender_id, receiver_id, product_id, message, created_at)
         VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
        [senderId, receiverId, productId, message]
      );
      io.to(room).emit("receiveMessage", rows[0]);
    } catch (err) {
      console.error("Socket sendMessage error:", err);
    }
  });

  socket.on("disconnect", () => console.log("❌ Socket disconnected:", socket.id));
});

// -------------------
// Start Server
// -------------------
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

export default app;