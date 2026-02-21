// server.js
import express from "express";
import cors from "cors";
import jwt from "express-jwt";
import jwksRsa from "jwks-rsa";

const app = express();
const PORT = process.env.PORT || 5000;

// ===== CORS =====
app.use(cors());
app.use(express.json());

// ===== Auth0 JWT Middleware =====
const checkJwt = jwt.expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.VITE_AUTH0_DOMAIN}/.well-known/jwks.json`
  }),
  audience: "your-api-audience", // must match your Auth0 API
  issuer: `https://${process.env.VITE_AUTH0_DOMAIN}/`,
  algorithms: ["RS256"]
});

// ===== Routes =====
app.get("/api/marketplace", checkJwt, (req, res) => {
  // This is a mock product list for testing
  res.json({
    success: true,
    products: [
      { id: 1, name: "Test Product 1" },
      { id: 2, name: "Test Product 2" },
    ],
    user: req.auth // JWT payload
  });
});

// ===== Start Server =====
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));