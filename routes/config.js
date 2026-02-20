import express from "express";

const router = express.Router();

// Health check + Auth0 config (safe for production)
router.get("/", (req, res) => {
  res.json({
    success: true,
    environment: process.env.NODE_ENV || "development",
    auth0Domain: process.env.AUTH0_DOMAIN ? `${process.env.AUTH0_DOMAIN}` : null,
    auth0ClientId: process.env.AUTH0_CLIENT_ID ? `${process.env.AUTH0_CLIENT_ID?.slice(0,8)}...` : null, // Partial for security
    auth0RedirectUri: process.env.AUTH0_REDIRECT_URI || null,
    apiAudience: process.env.AUTH0_AUDIENCE || null,
    isProduction: process.env.NODE_ENV === "production"
  });
});

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({ 
    success: true, 
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

export default router;