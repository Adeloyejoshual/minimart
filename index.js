require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const socketHandlers = require("./socketHandlers");
const paystackWebhookHandler = require("./paystackWebhook");

const app = express();
const PORT = process.env.PORT || 3000;

// HTTP + Socket.IO
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Middleware
app.use(cors());
app.use(express.json());
app.use("/api/paystack/webhook", express.raw({ type: "application/json" }));

// Socket.IO
socketHandlers(io);

// Paystack Webhook
app.post("/api/paystack/webhook", (req, res) => paystackWebhookHandler(req, res, io));

// Serve React SPA
app.use(express.static(path.join(__dirname, "../build")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "../build", "index.html")));

// Start server
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));