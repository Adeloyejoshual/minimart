// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

// Routes
import marketplaceRoutes from "./src/routes/marketplace.js";
import minimartRoutes from "./routes/minimart.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5000;

// --- APP SETUP ---
const app = express();

// --- SECURITY & PERFORMANCE MIDDLEWARE ---
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// --- RATE LIMIT ---
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per window
});
app.use(limiter);

// --- MONGODB CONNECTION ---
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// --- COCKROACHDB CONNECTION ---
const cockroachPool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

cockroachPool.connect()
  .then(() => console.log("✅ CockroachDB connected"))
  .catch(err => console.error("❌ CockroachDB connection error:", err));

// Make CockroachDB pool accessible in routes
app.use((req, res, next) => {
  req.cockroach = cockroachPool;
  next();
});

// --- BULLMQ / REDIS QUEUE SETUP ---
const connection = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379");
export const exampleQueue = new Queue("example-queue", { connection });

// Example worker
new Worker("example-queue", async job => {
  console.log("Processing job:", job.id, job.name, job.data);
}, { connection });

// --- API ROUTES ---
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/minimart", minimartRoutes);

// --- SERVE FRONTEND IN PRODUCTION ---
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});