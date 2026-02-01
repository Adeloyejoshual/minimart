require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
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
const client = new MongoClient(process.env.MONGODB_URI);
let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db(client.s.options.dbName); // get DB name from URI
    app.locals.db = db;

    console.log(`✅ Connected to MongoDB database: ${client.s.options.dbName}`);

    // Create default collections if missing
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

/* -------------------- JWT Middleware -------------------- */
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

/* -------------------- Auth Routes -------------------- */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ message: "All fields required" });

    const existing = await db.collection("users").findOne({ email });
    if (existing) return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const result = await db.collection("users").insertOne({ email, password: hashed, name, createdAt: new Date() });

    const token = jwt.sign({ id: result.insertedId, email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: result.insertedId, email, name } });
  } catch {
    res.status(500).json({ message: "Failed to register user" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "All fields required" });

    const user = await db.collection("users").findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user._id, email, name: user.name } });
  } catch {
    res.status(500).json({ message: "Failed to login user" });
  }
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const user = await db.collection("users").findOne({ _id: new ObjectId(req.user.id) });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ id: user._id, email: user.email, name: user.name });
  } catch {
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

/* -------------------- Socket.IO -------------------- */
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  socket.on("joinRoom", (userId) => socket.join(userId));

  socket.on("disconnect", () => console.log("❌ Client disconnected:", socket.id));
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
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "../build", "index.html")));

/* -------------------- Start Server -------------------- */
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));