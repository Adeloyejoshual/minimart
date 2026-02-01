require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");
const http = require("http");
const { Server } = require("socket.io");

// Routes
const locationsRouter = require("./api/locations");
const martProductRoutes = require("./routes/martProducts");

const app = express();
const PORT = process.env.PORT || 3000;

/* -------------------- HTTP + Socket Setup -------------------- */
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

/* -------------------- Middleware -------------------- */
app.use(cors());
app.use(express.json());
app.use("/api/paystack/webhook", express.raw({ type: "application/json" }));

/* -------------------- MongoDB -------------------- */
const client = new MongoClient(process.env.REACT_APP_MONGODB_URI || process.env.MONGODB_URI);
let db;

async function connectDB() {
  try {
    await client.connect();

    // Extract database name from URI
    const uriDbName = client.s.options.dbName; // MongoClient automatically parses db name from URI
    db = client.db(uriDbName);

    app.locals.db = db; // make db available in routes

    console.log(`✅ Connected to MongoDB database: ${uriDbName}`);

    // Optional: create default collections if they don't exist
    const collections = await db.listCollections().toArray();
    const existing = collections.map(c => c.name);

    ["users", "products", "cart", "admins", "wallets"].forEach(async (name) => {
      if (!existing.includes(name)) {
        await db.createCollection(name);
        console.log(`🗂 Created collection: ${name}`);
      }
    });

  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
  }
}
connectDB();

/* -------------------- Socket.IO -------------------- */
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  socket.on("joinRoom", (userId) => socket.join(userId));

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

/* -------------------- Helper Functions -------------------- */
async function updateProductPromotion(productId, promotionPlanId) {
  await db.collection("products").updateOne(
    { _id: new ObjectId(productId) },
    { $set: { promoted: true, promotionPlanId, promotionDate: new Date() } }
  );
}

async function updateKycStatus(userId, status) {
  await db.collection("users").updateOne(
    { _id: new ObjectId(userId) },
    { $set: { kycStatus: status } }
  );
  io.to(userId).emit("kycStatusUpdated", { userId, status });
}

async function updateCart(userId, cartItems) {
  await db.collection("cart").updateOne(
    { userId },
    { $set: { items: cartItems } },
    { upsert: true }
  );
  io.to(userId).emit("cartUpdated", { userId, items: cartItems });
}

/* -------------------- API Routes -------------------- */
app.use("/api/locations", locationsRouter);
app.use("/api/mart-products", martProductRoutes);

/* -------------------- Admin Routes -------------------- */
app.get("/api/admin/list", async (req, res) => {
  try {
    const admins = await db.collection("admins").find().toArray();
    res.json(admins);
  } catch {
    res.status(500).json({ message: "Failed to fetch admins" });
  }
});

app.post("/api/admin/create", async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !role) return res.status(400).json({ message: "Email and role required" });

    const existing = await db.collection("admins").findOne({ email });
    if (existing) return res.status(400).json({ message: "Admin already exists" });

    const result = await db.collection("admins").insertOne({
      email,
      role,
      createdAt: new Date()
    });

    res.json({ message: "Admin created", id: result.insertedId });
  } catch {
    res.status(500).json({ message: "Failed to create admin" });
  }
});

/* -------------------- KYC + Cart -------------------- */
app.post("/api/kyc/update", async (req, res) => {
  try {
    const { userId, status } = req.body;
    await updateKycStatus(userId, status);
    res.json({ message: "KYC updated" });
  } catch {
    res.status(500).json({ error: "Failed to update KYC" });
  }
});

app.post("/api/cart/update", async (req, res) => {
  try {
    const { userId, items } = req.body;
    await updateCart(userId, items);
    res.json({ message: "Cart updated" });
  } catch {
    res.status(500).json({ error: "Failed to update cart" });
  }
});

/* -------------------- Paystack Webhook -------------------- */
app.post("/api/paystack/webhook", async (req, res) => {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(req.body)
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"])
    return res.status(400).send("Invalid signature");

  const event = JSON.parse(req.body);

  if (event.event === "charge.success") {
    const { metadata } = event.data;

    if (metadata?.productId && metadata?.promotionPlanId) {
      await updateProductPromotion(metadata.productId, metadata.promotionPlanId);
    }

    if (metadata?.userId && metadata?.walletAmount) {
      const wallet = await db.collection("wallets").findOneAndUpdate(
        { userId: metadata.userId },
        { $inc: { balance: metadata.walletAmount } },
        { upsert: true, returnDocument: "after" }
      );
      io.to(metadata.userId).emit("walletUpdated", wallet.value);
    }
  }

  res.sendStatus(200);
});

/* -------------------- Serve React Build -------------------- */
app.use(express.static(path.join(__dirname, "../build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../build", "index.html"));
});

/* -------------------- Start Server -------------------- */
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));