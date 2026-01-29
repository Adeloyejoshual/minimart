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
const io = new Server(server, { cors: { origin: "*" } });

// -------------------- Middleware --------------------
app.use(cors());
app.use(express.json());
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

  socket.on("joinRoom", (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room ${userId}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// -------------------- Helper Functions --------------------
async function updateProductPromotion(productId, promotionPlanId) {
  if (!db) throw new Error("DB not connected");
  await db.collection("products").updateOne(
    { _id: new ObjectId(productId) },
    { $set: { promoted: true, promotionPlanId, promotionDate: new Date() } }
  );
}

async function spinReward(userId) {
  if (!db) throw new Error("DB not connected");
  const coupons = db.collection("coupons");
  const spins = db.collection("spins");

  const coupon = await coupons.aggregate([
    { $match: { used: false } },
    { $sample: { size: 1 } }
  ]).next();

  if (!coupon) return null;

  await coupons.updateOne({ _id: coupon._id }, { $set: { used: true } });
  await spins.insertOne({ userId, couponId: coupon._id, timestamp: new Date() });

  io.to(userId).emit("couponWon", coupon);
  return coupon;
}

async function updateKycStatus(userId, status) {
  if (!db) throw new Error("DB not connected");
  const users = db.collection("users");
  await users.updateOne({ _id: new ObjectId(userId) }, { $set: { kycStatus: status } });
  io.to(userId).emit("kycStatusUpdated", { userId, status });
}

async function updateCart(userId, cartItems) {
  if (!db) throw new Error("DB not connected");
  const cart = db.collection("cart");
  await cart.updateOne({ userId }, { $set: { items: cartItems } }, { upsert: true });
  io.to(userId).emit("cartUpdated", { userId, items: cartItems });
}

// -------------------- API Routes --------------------

// Locations
app.use("/api/locations", locationsRouter);

// ---------------- Admin Routes --------------------
app.get("/api/admin/list", async (req, res) => {
  try {
    if (!db) throw new Error("DB not connected");
    const admins = await db.collection("admins").find().toArray();
    res.json(admins);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch admins" });
  }
});

app.post("/api/admin/create", async (req, res) => {
  try {
    if (!db) throw new Error("DB not connected");
    const { email, role } = req.body;
    if (!email || !role) return res.status(400).json({ message: "Email and role are required" });

    const existing = await db.collection("admins").findOne({ email });
    if (existing) return res.status(400).json({ message: "Admin already exists" });

    const result = await db.collection("admins").insertOne({
      email,
      role,
      createdAt: new Date()
    });

    res.json({ message: "Admin created", id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create admin" });
  }
});

// Spin coupon
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

// Update KYC status manually (Admin)
app.post("/api/kyc/update", async (req, res) => {
  try {
    const { userId, status } = req.body;
    await updateKycStatus(userId, status);
    res.json({ message: "KYC status updated", status });
  } catch (err) {
    console.error("KYC update error:", err);
    res.status(500).json({ error: "Failed to update KYC status" });
  }
});

// Update cart manually
app.post("/api/cart/update", async (req, res) => {
  try {
    const { userId, items } = req.body;
    await updateCart(userId, items);
    res.json({ message: "Cart updated", items });
  } catch (err) {
    console.error("Cart update error:", err);
    res.status(500).json({ error: "Failed to update cart" });
  }
});

// -------------------- Paystack Webhook --------------------
app.post("/api/paystack/webhook", async (req, res) => {
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  const paystackSignature = req.headers["x-paystack-signature"];

  const hash = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(req.body).digest("hex");
  if (hash !== paystackSignature) return res.status(400).send("Invalid signature");

  const event = JSON.parse(req.body);
  if (event.event === "charge.success") {
    const { metadata, amount, reference } = event.data;
    console.log(`✅ Payment verified: ${reference} - ${amount / 100} NGN`);

    if (metadata?.productId && metadata?.promotionPlanId)
      await updateProductPromotion(metadata.productId, metadata.promotionPlanId);

    if (metadata?.userId && metadata?.walletAmount) {
      const wallets = db.collection("wallets");
      const walletUpdate = await wallets.findOneAndUpdate(
        { userId: metadata.userId },
        { $inc: { balance: metadata.walletAmount } },
        { upsert: true, returnDocument: "after" }
      );
      io.to(metadata.userId).emit("walletUpdated", walletUpdate.value);
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
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));