// server.js - FIXED FOR RENDER DEPLOYMENT ✅
// Auth0 JWT + MongoDB + Marketplace API

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { expressjwt as jwt } from "express-jwt";
import jwksRsa from "jwks-rsa";
import dotenv from "dotenv";
import mongoose from "mongoose";
import marketplaceRouter from "./routes/marketplace.js";  // ✅ Fixed import

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://minimart-ivrm.onrender.com', 'http://localhost:3000']
    : true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI || process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);  // Exit on DB failure
  });

// Auth0 JWT Middleware
const checkJwt = jwt({
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

// Routes
app.use("/api/marketplace", checkJwt, marketplaceRouter);  // ✅ Protected
app.get("/api/health", (req, res) => res.json({ success: true, timestamp: new Date().toISOString() }));

// Frontend SPA (Vite build)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

// Error Handling
app.use((err, req, res, next) => {
  console.error("🚨 Server Error:", err);
  
  if (err.name === "UnauthorizedError") {
    return res.status(401).json({ 
      success: false, 
      message: "Invalid or missing token. Please log in." 
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      success: false, 
      message: "Token expired or invalid" 
    });
  }
  
  res.status(500).json({ 
    success: false, 
    message: "Internal server error" 
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Minimart Server running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
});