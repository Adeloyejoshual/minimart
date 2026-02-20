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
import configRoutes from "./routes/config.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

/* ========================
   SECURITY & MIDDLEWARE
======================== */

if (process.env.NODE_ENV === "production") {
  app.use(helmet());
  app.use(compression());
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100
  })
);

/* ========================
   DATABASE CONNECTIONS
======================== */

// MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err.message));

// CockroachDB
const cockroachPool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false }
});

cockroachPool
  .connect()
  .then(() => console.log("✅ CockroachDB connected"))
  .catch(err => console.error("❌ CockroachDB error:", err.message));

app.use((req, res, next) => {
  req.cockroach = cockroachPool;
  next();
});

/* ========================
   REDIS & BULLMQ
======================== */

let redisConnection;
let exampleQueue;

if (process.env.REDIS_URL) {
  try {
    redisConnection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null
    });

    redisConnection.on("connect", () =>
      console.log("✅ Redis connected")
    );

    redisConnection.on("error", err =>
      console.error("❌ Redis error:", err.message)
    );

    exampleQueue = new Queue("example-queue", {
      connection: redisConnection
    });

    new Worker(
      "example-queue",
      async job => {
        console.log("Processing job:", job.id, job.data);
      },
      { connection: redisConnection }
    );

  } catch (err) {
    console.error("❌ Redis initialization failed:", err.message);
  }
} else {
  console.warn("⚠️ REDIS_URL not set — skipping Redis");
}

/* ========================
   ROUTES
======================== */

app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/minimart", minimartRoutes);
app.use("/api/config", configRoutes);

/* ========================
   SERVE FRONTEND
======================== */

if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "dist");
  app.use(express.static(distPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

/* ========================
   ERROR HANDLER
======================== */

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err.message
  });
});

/* ========================
   START SERVER
======================== */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});