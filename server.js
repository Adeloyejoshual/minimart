// server.js - 100% RENDER READY
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

// 🆕 FIX 1: Don't crash on MongoDB failure
let mongoConnected = false;

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://minimart-ivrm.onrender.com', 'http://localhost:3000']
    : true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 🆕 FIX 2: MongoDB - DON'T EXIT, continue without DB
if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log("✅ MongoDB connected");
      mongoConnected = true;
    })
    .catch((err) => {
      console.error("⚠️ MongoDB failed, using in-memory:", err.message);
      mongoConnected = false;
    });
} else {
  console.log("⚠️ No MONGO_URI, using in-memory storage");
}

// Auth0 JWT Middleware (optional - comment out if no Auth0)
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

// Routes - PUBLIC ACCESS (no auth required)
app.use("/api/marketplace", marketplaceRouter);  // 🆕 REMOVED checkJwt
app.get("/api/health", (req, res) => res.json({ 
  success: true, 
  mongodb: mongoConnected,
  timestamp: new Date().toISOString() 
}));

// Frontend SPA (Vite build)
if (process.env.NODE_ENV === 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

// Error Handling
app.use((err, req, res, next) => {
  console.error("🚨 Error:", err);
  res.status(500).json({ success: false, message: "Server error" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
});