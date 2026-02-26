// server.js - ✅ FIXED ROUTING + PRODUCTION READY
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { expressjwt as jwt } from "express-jwt";
import jwksRsa from "jwks-rsa";
import dotenv from "dotenv";
import mongoose from "mongoose";
import marketplaceRouter from "./routes/marketplace.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🛡️ ENTERPRISE: Graceful MongoDB handling
let mongoConnected = false;

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://minimart-ivrm.onrender.com', 'http://localhost:3000']
    : true,
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ ROUTES FIRST - BEFORE STATIC FILES
app.use("/api/marketplace", marketplaceRouter);  // ✅ Matches AddProduct.jsx

// 🛡️ MongoDB Connection
if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log("✅ MongoDB Connected ✅");
      mongoConnected = true;
    })
    .catch((err) => {
      console.error("⚠️ MongoDB failed, continuing:", err.message);
      mongoConnected = false;
    });
} else {
  console.warn("⚠️ No MONGO_URI - Running without database");
}

// 🛡️ Auth0 (optional)
let checkJwt;
if (process.env.AUTH0_DOMAIN && process.env.AUTH0_AUDIENCE) {
  checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
    }),
    audience: process.env.AUTH0_AUDIENCE,
    issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    algorithms: ["RS256"],
  });
}

// 🆕 HEALTH CHECK
app.get("/api/health", (req, res) => res.json({ 
  success: true, 
  mongodb: mongoConnected,
  timestamp: new Date().toISOString(),
  endpoints: [
    'POST /api/marketplace/products',
    'GET /api/marketplace/products',
    'GET /api/marketplace/my-products'
  ]
}));

// 🆕 STATS ENDPOINT
app.get("/api/stats", async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.json({ success: true, data: { totalProducts: 0 } });
    }
    
    const Product = mongoose.model('Product');
    const stats = await Promise.all([
      Product.countDocuments({ status: 'active' }),
      Product.countDocuments({ promoted: true }),
      Product.distinct('category', { status: 'active' })
    ]);

    res.json({
      success: true,
      data: {
        totalProducts: stats[0],
        promotedProducts: stats[1],
        categories: stats[2].length,
        mongodb: true
      }
    });
  } catch (error) {
    res.json({ success: false, message: 'Stats unavailable' });
  }
});

// ✅ PRODUCTION: Serve Vite Frontend
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, "dist")));
  
  // SPA catch-all - AFTER API routes
  app.get("*", (req, res) => {
    // Don't serve frontend for API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ success: false, message: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

// 🛡️ ERROR HANDLING
app.use((err, req, res, next) => {
  console.error("🚨 ERROR:", {
    url: req.originalUrl,
    method: req.method,
    error: err.message
  });
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error' 
  });
});

// 🛡️ 404 Handler
app.use("*", (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: `Route ${req.method} ${req.originalUrl} not found` 
  });
});

// 🛡️ GRACEFUL SHUTDOWN
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  console.log(`🛒 Products: POST http://localhost:${PORT}/api/marketplace/products`);
  console.log(`💾 MongoDB: ${mongoConnected ? '✅ CONNECTED' : '⚠️ OFFLINE'}`);
});

export default app;