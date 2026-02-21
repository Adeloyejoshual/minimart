// server.js
import express from "express";
import cors from "cors";
import { expressjwt as jwt } from "express-jwt"; // modern import
import jwksRsa from "jwks-rsa";
import dotenv from "dotenv";

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
    jwksUri: `https://${process.env.VITE_AUTH0_DOMAIN}/.well-known/jwks.json`,
  }),
  audience: process.env.VITE_AUTH0_AUDIENCE, // Must match your Auth0 API
  issuer: `https://${process.env.VITE_AUTH0_DOMAIN}/`,
  algorithms: ["RS256"],
});

// ===== Protected Route =====
app.get("/api/marketplace", checkJwt, (req, res) => {
  res.json({
    success: true,
    products: [
      { id: 1, name: "Test Product 1" },
      { id: 2, name: "Test Product 2" },
    ],
    user: req.auth, // JWT payload
  });
});

// ===== Public Test Route =====
app.get("/api/public", (req, res) => {
  res.json({ message: "Public endpoint works!" });
});

// ===== Start Server =====
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);