// -------------------- Imports --------------------
require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");
const http = require("http");
const { Server } = require("socket.io");
const locationsRouter = require("./api/locations");

// -------------------- App Setup --------------------
const app = express();
const PORT = process.env.PORT || 3000;

// HTTP server for Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Enable CORS
app.use(cors());

// Parse JSON (except for Paystack webhook)
app.use(express.json());

// Raw body parser for Paystack webhook
app.use("/api/paystack/webhook", express.raw({ type: "application/json" }));

// -------------------- MongoDB Setup --------------------
const client = new MongoClient(process.env.MONGODB_URI);
let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db(process.env.DB_NAME || "martDB");
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
  }
}
connectDB();

// -------------------- Socket.IO --------------------
io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  // Join user-specific room for live updates
  socket.on("joinRoom", (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room ${userId}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// -------------------- Helper Functions --------------------

// Update product promotion in DB
async function updateProductPromotion(productId, promotionPlanId) {
  if (!db) throw new Error("DB not connected");
  const products = db.collection("products");
  await products.updateOne(
    { _id: new ObjectId(productId) },
    { $set: { promoted: true, promotionPlanId, promotionDate: new Date() } }
  );
}

// Spin reward coupon for user
async function spinReward(userId) {
  if (!db) throw new Error("DB not connected");
  const coupons = db.collection("coupons");
  const spins = db.collection("spins");

  // Pick a random unused coupon
  const coupon = await coupons.aggregate([
    { $match: { used: false } },
    { $sample: { size: 1 } }
  ]).next();

  if (!coupon) return null;

  // Mark coupon as used
  await coupons.updateOne({ _id: coupon._id }, { $set: { used: true } });

  // Log spin
  await spins.insertOne({ userId, couponId: coupon._id, timestamp: new Date() });

  // Emit real-time update to user
  io.to(userId).emit("couponWon", coupon);

  return coupon;
}

// -------------------- API Routes --------------------

// Locations API
app.use("/api/locations", locationsRouter);

// Spin coupon endpoint
app.post("/api/spin/:userId", async (req, res) => {
  try {
    const coupon = await spinReward(req.params.userId);
    if (!coupon) return res.json({ message: "No coupons left!" });
    res.json({ message: "You won a coupon!", coupon });
  } catch (err) {
    console.error("Spin error:", err);
    res.status(500).json({ error: "Failed to spin coupon" });
  }
});

// -------------------- Paystack Webhook --------------------
app.post("/api/paystack/webhook", async (req, res) => {
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  const paystackSignature = req.headers["x-paystack-signature"];

  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(req.body)
    .digest("hex");

  if (hash !== paystackSignature) {
    console.log("⚠️ Invalid Paystack signature");
    return res.status(400).send("Invalid signature");
  }

  const event = JSON.parse(req.body);

  if (event.event === "charge.success") {
    const { reference, amount, customer, metadata } = event.data;
    console.log(`✅ Payment verified: ${reference} - ${amount / 100} NGN`);

    // Handle product promotion
    if (metadata?.productId && metadata?.promotionPlanId) {
      updateProductPromotion(metadata.productId, metadata.promotionPlanId)
        .then(() => console.log("Product promotion updated"))
        .catch(err => console.error("Failed to update product promotion:", err));
    }

    // Handle wallet credit
    if (metadata?.userId && metadata?.walletAmount) {
      const wallets = db.collection("wallets");
      const walletUpdate = await wallets.findOneAndUpdate(
        { userId: metadata.userId },
        { $inc: { balance: metadata.walletAmount } },
        { upsert: true, returnDocument: "after" }
      );

      // Emit real-time wallet update
      io.to(metadata.userId).emit("walletUpdated", walletUpdate.value);
      console.log(`Wallet credited for user ${metadata.userId}`);
    }
  }

  res.sendStatus(200);
});

// -------------------- Serve React Frontend --------------------
app.use(express.static(path.join(__dirname, "../build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../build", "index.html"));
});

// -------------------- Start Server --------------------
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});