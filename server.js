require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// HTTP + Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use("/api/paystack/webhook", express.raw({ type: "application/json" }));

// -------------------- Socket.IO --------------------
// Real-time updates for cart, wallet, and KYC
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  // Join a room (per-user)
  socket.on("joinRoom", (userId) => socket.join(userId));

  // Receive events from client
  socket.on("cartUpdated", ({ userId, items }) => {
    io.to(userId).emit("cartUpdated", { userId, items });
  });

  socket.on("kycStatusUpdated", ({ userId, status }) => {
    io.to(userId).emit("kycStatusUpdated", { userId, status });
  });

  socket.on("disconnect", () => console.log("❌ Client disconnected:", socket.id));
});

// -------------------- Paystack Webhook --------------------
app.post("/api/paystack/webhook", (req, res) => {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(req.body)
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"]) return res.status(400).send("Invalid signature");

  const event = JSON.parse(req.body);
  const { metadata } = event.data;

  if (event.event === "charge.success") {
    if (metadata?.userId && metadata?.walletAmount) {
      io.to(metadata.userId).emit("walletUpdated", { balance: metadata.walletAmount });
    }
  }

  res.sendStatus(200);
});

// -------------------- Serve React SPA --------------------
app.use(express.static(path.join(__dirname, "../build")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "../build", "index.html")));

// -------------------- Start Server --------------------
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));