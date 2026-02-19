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

import marketplaceRoutes from "./routes/marketplace.js";
import minimartRoutes from "./routes/minimart.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5000;

const app = express();

// SECURITY & PERFORMANCE
if (process.env.NODE_ENV === "production") {
  app.use(helmet());
  app.use(compression());
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// RATE LIMIT
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

// MONGODB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// COCKROACHDB
const cockroachPool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false }
});
cockroachPool.connect()
  .then(() => console.log("✅ CockroachDB connected"))
  .catch(err => console.error("❌ CockroachDB connection error:", err));

app.use((req, res, next) => { req.cockroach = cockroachPool; next(); });

// BULLMQ / REDIS
const redisConnection = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379");
export const exampleQueue = new Queue("example-queue", { connection: redisConnection });

new Worker("example-queue", async job => {
  console.log("Processing job:", job.id, job.name, job.data);
}, { connection: redisConnection });

// ROUTES
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/minimart", minimartRoutes);

// SERVE FRONTEND
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
}

// ERROR HANDLER
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Something went wrong!", error: err.message });
});

// START SERVER
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT} (${process.env.NODE_ENV || "development"})`));

export default app;