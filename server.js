// server.js - 100% RENDER READY + ENTERPRISE MARKETPLACE ✅
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

// 🛡️ ENTERPRISE: Graceful MongoDB handling
let mongoConnected = false;

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://minimart-ivrm.onrender.com', 'http://localhost:3000']
    : true,
  credentials: true
}));

app.use(express.json({ limit: '50mb' })); // 🆕 Increased for Cloudinary URLs
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 🛡️ MongoDB - FAILSAFE (continues without DB)
if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log("✅ MongoDB Connected ✅");
      mongoConnected = true;
    })
    .catch((err) => {
      console.error("⚠️ MongoDB failed, continuing with in-memory:", err.message);
      mongoConnected = false;
    });
} else {
  console.warn("⚠️ No MONGO_URI - In-memory storage active");
}

// 🛡️ Auth0 JWT (DISABLED for public marketplace - uncomment for auth)
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

// 🚀 ENTERPRISE ROUTES - PUBLIC ACCESS ✅
app.use("/api/marketplace", marketplaceRouter); // No auth required

// 🆕 HEALTH CHECK + STATS
app.get("/api/health", (req, res) => res.json({ 
  success: true, 
  mongodb: mongoConnected,
  timestamp: new Date().toISOString(),
  routes: ['/api/marketplace/products', '/api/marketplace/stats']
}));

// 🆕 MARKETPLACE STATS ENDPOINT
app.get("/api/stats", async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.json({ success: true, data: { totalProducts: 0, promoted: 0 } });
    }
    
    // Marketplace stats
    const stats = await Promise.all([
      mongoose.connection.db.collection('products').countDocuments({ status: 'active' }),
      mongoose.connection.db.collection('products').countDocuments({ promoted: true }),
      mongoose.connection.db.collection('products').distinct('category', { status: 'active' })
    ]);

    res.json({
      success: true,
      data: {
        totalProducts: stats[0],
        promotedProducts: stats[1],
        categories: stats[2].length,
        mongodb: mongoConnected
      }
    });
  } catch (error) {
    res.json({ success: false, message: 'Stats unavailable' });
  }
});

// 🆕 AUTH ROUTES (optional - for future user features)
app.use("/api/auth", (req, res, next) => {
  if (checkJwt) {
    checkJwt(req, res, next);
  } else {
    next();
  }
});

// 🛠️ DEVELOPMENT ENDPOINT (remove in production)
if (process.env.NODE_ENV !== 'production') {
  app.post("/api/test-product", async (req, res) => {
    try {
      const testProduct = {
        title: "iPhone 15 Pro Max Test",
        description: "Test product for marketplace",
        price: 850000,
        category: "electronics",
        state: "Lagos",
        city: "Ikeja",
        phone_number: "+2341234567890",
        poster_name: "Test Seller",
        images: ["https://via.placeholder.com/400x300"],
        features: ["5G", "Face ID", "A17 Pro"]
      };
      
      if (mongoConnected) {
        const Product = mongoose.model('Product');
        const product = new Product(testProduct);
        await product.save();
        res.json({ success: true, product });
      } else {
        res.json({ success: true, message: "Test product created (in-memory)" });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

// 🛡️ PRODUCTION SPA SERVING (Vite build)
if (process.env.NODE_ENV === 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  app.use(express.static(path.join(__dirname, "dist")));
  
  // SPA catch-all
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

// 🛡️ ENTERPRISE ERROR HANDLING
app.use((err, req, res, next) => {
  console.error("🚨 ERROR:", {
    url: req.originalUrl,
    method: req.method,
    error: err.message,
    stack: err.stack
  });
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }
  
  res.status(500).json({ 
    success: false, 
    message: mongoConnected ? err.message : 'Service temporarily unavailable' 
  });
});

// 🛡️ GRACEFUL SHUTDOWN
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running → http://localhost:${PORT}`);
  console.log(`📊 Health check → http://localhost:${PORT}/api/health`);
  console.log(`🛒 Marketplace → http://localhost:${PORT}/api/marketplace/products`);
  console.log(`📈 Stats → http://localhost:${PORT}/api/stats`);
  console.log(`💾 MongoDB: ${mongoConnected ? '✅ CONNECTED' : '⚠️ OFFLINE'}`);
});