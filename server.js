import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { expressjwt as jwt } from "express-jwt";
import jwksRsa from "jwks-rsa";
import dotenv from "dotenv";
import marketplaceRouter from "./routes/marketplace.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://minimart-ivrm.onrender.com", "http://localhost:3000"]
        : true,
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Routes
app.use("/api/marketplace", marketplaceRouter);

// Auth0 JWT middleware (optional)
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

// Health check
app.get("/api/health", (req, res) =>
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    endpoints: [
      "POST /api/marketplace/products",
      "GET /api/marketplace/products",
      "GET /api/marketplace/my-products",
    ],
  })
);

// Production: serve Vite frontend
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ success: false, message: "API endpoint not found" });
    }
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

// Error handling
app.use((err, req, res, next) => {
  console.error("🚨 ERROR:", {
    url: req.originalUrl,
    method: req.method,
    error: err.message,
  });

  if (err.name === "UnauthorizedError") {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Shutting down gracefully");
  process.exit(0);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
});

export default app;