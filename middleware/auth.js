// middleware/auth.js
import jwt from "express-jwt";
import jwksRsa from "jwks-rsa";
import User from "../models/User.js";

// Middleware to verify Auth0 JWT access tokens
export const checkJwt = jwt({
  // Dynamically provide a signing key based on the kid in the header and JWKS endpoint
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
  }),

  // Validate the audience and the issuer
  audience: process.env.AUTH0_AUDIENCE,
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
  algorithms: ["RS256"]
});

// Optional: attach Auth0 user info to req.user and/or MongoDB user
export const attachUser = async (req, res, next) => {
  try {
    if (!req.user || !req.user.sub) return res.status(401).json({ error: "Unauthorized" });

    // Find user in MongoDB or create if not exists
    let user = await User.findOne({ auth0Id: req.user.sub });
    if (!user) {
      user = await User.create({
        auth0Id: req.user.sub,
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};