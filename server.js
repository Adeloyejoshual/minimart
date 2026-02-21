// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { expressjwt as jwt } from "express-jwt";
import jwksRsa from "jwks-rsa";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ================= CORS =================
app.use(cors());
app.use(express.json());

// ================= AUTH0 JWT =================
const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.VITE_AUTH0_DOMAIN}/.well-known/jwks.json`,
  }),
  audience: process.env.VITE_AUTH0_AUDIENCE,
  issuer: `https://${process.env.VITE_AUTH0_DOMAIN}/`,
  algorithms: ["RS256"],
});

// ================= STATIC REACT BUILD =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "dist")));

// ================= API ROUTES =================
app.get("/api/marketplace", checkJwt, (req, res) => {
  res.json({
    success: true,
    user: req.auth, // JWT payload
    products: [
      { id: 1, name: "Test Product 1" },
      { id: 2, name: "Test Product 2" },
    ],
  });
});

// ================= SPA FALLBACK =================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ================= START SERVER =================
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);