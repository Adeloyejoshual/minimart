// app.js - ENTERPRISE PRODUCTION READY
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
import MarketplaceProduct from "./models/MarketplaceProduct.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ================= PRODUCTION MIDDLEWARE =================
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"]
      }
    }
  }));
  app.use(compression());
}

app.use(cors({ 
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL.split(',') 
    : true,
  credentials: true 
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ================= DATABASES =================
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 20,
  serverSelectionTimeoutMS: 5000,
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB error:", err));

export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: process.env.NODE_ENV === 'production' ? true : { rejectUnauthorized: false },
  max: 20,
});

(async () => {
  try {
    await pool.connect();
    console.log("✅ CockroachDB ready");
  } catch (err) {
    console.error("❌ CockroachDB error:", err);
  }
})();

// ================= BULLMQ + REDIS =================
const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3,
});

export const viewQueue = new Queue('productViews', { connection: redisConnection });

// Background worker for view processing
const viewWorker = new Worker('productViews', async (job) => {
  const { productId } = job.data;
  await MarketplaceProduct.updateOne(
    { _id: productId, active: true, status: 'active' },
    {
      $inc: { views_total: 1, views_today: 1 },
      $set: { 
        last_viewed: new Date(),
        live_viewers: Math.floor(Math.random() * 20) + 3
      }
    }
  );
}, { connection: redisConnection });

// ================= ENHANCED VIEW ENDPOINT =================
app.post("/api/marketplace/:id/increment-view", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Queue async processing (non-blocking)
    await viewQueue.add('increment', { 
      productId: id,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, message: 'View queued' });
  } catch (error) {
    res.status(500).json({ success: false, error: "Queue failed" });
  }
});

// ================= CACHING MIDDLEWARE =================
const cacheMiddleware = (duration = 300) => async (req, res, next) => {
  const key = `cache:${req.originalUrl}`;
  try {
    const cached = await redisConnection.get(key);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    res.sendResponse = res.json;
    res.json = async (body) => {
      await redisConnection.setex(key, duration, JSON.stringify(body));
      res.sendResponse(body);
    };
    next();
  } catch (error) {
    next();
  }
};

// ================= ROUTES =================
import marketplaceRoutes from "./routes/marketplace.js";
import minimartRoutes from "./routes/minimart.js";

app.use("/api/marketplace", cacheMiddleware(300), marketplaceRoutes);
app.use("/api/minimart", minimartRoutes);

// ================= ERROR HANDLING =================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

// ================= SPA ROUTING =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "dist");

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distPath, {
    maxAge: '1y',
    etag: false
  }));

  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// ================= GRACEFUL SHUTDOWN =================
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await mongoose.connection.close();
  await pool.end();
  await redisConnection.quit();
  await viewQueue.close();
  await viewWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// ================= START SERVER =================
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

// Production health check
if (process.env.NODE_ENV === 'production') {
  app.get('/health', async (req, res) => {
    try {
      await mongoose.connection.db.admin().ping();
      await pool.query('SELECT 1');
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    } catch (error) {
      res.status(503).json({ status: 'unhealthy' });
    }
  });
}

export default app;
