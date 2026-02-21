import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import jwt from "express-jwt";
import jwksRsa from "jwks-rsa";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ===== CORS =====
app.use(cors());
app.use(express.json());

// ===== Auth0 JWT Middleware =====
const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.VITE_AUTH0_DOMAIN}/.well-known/jwks.json`
  }),
  audience: process.env.VITE_AUTH0_AUDIENCE,
  issuer: `https://${process.env.VITE_AUTH0_DOMAIN}/`,
  algorithms: ["RS256"]
});

// ===== Mock API =====
app.get("/api/marketplace", checkJwt, (req, res) => {
  res.json({
    success: true,
    products: [
      { id: 1, name: "Test Product 1" },
      { id: 2, name: "Test Product 2" },
    ],
    user: req.auth
  });
});

// ===== Serve React build =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "dist");

app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});