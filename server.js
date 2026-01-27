// -------------------- Imports --------------------
require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto"); // For verifying Paystack signature
const { MongoClient, ObjectId } = require("mongodb");
const locationsRouter = require("./api/locations");

// -------------------- App Setup --------------------
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON
app.use(express.json());

// -------------------- MongoDB Setup --------------------
const mongoUri = process.env.MONGODB_URI; // MongoDB Atlas URI
const client = new MongoClient(mongoUri);
let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db(process.env.DB_NAME || "martDB");
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
  }
}
connectDB();

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

  // Log the spin
  await spins.insertOne({ userId, couponId: coupon._id, timestamp: new Date() });

  return coupon;
}

// -------------------- API Routes --------------------
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
app.post("/api/paystack/webhook", (req, res) => {
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

  // Get Paystack signature from headers
  const paystackSignature = req.headers["x-paystack-signature"];

  // Compute hash of the request body
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest("hex");

  // Verify signature
  if (hash !== paystackSignature) {
    console.log("⚠️ Invalid Paystack signature");
    return res.status(400).send("Invalid signature");
  }

  const event = req.body;

  if (event.event === "charge.success") {
    const { reference, amount, customer, metadata } = event.data;

    console.log(`✅ Payment verified: ${reference} - ${amount / 100} NGN`);

    if (metadata?.productId && metadata?.promotionPlanId) {
      updateProductPromotion(metadata.productId, metadata.promotionPlanId)
        .then(() => console.log("Product promotion updated"))
        .catch(err => console.error("Failed to update product promotion:", err));
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
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});