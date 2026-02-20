import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    auth0Domain: process.env.AUTH0_DOMAIN,
    auth0ClientId: process.env.AUTH0_CLIENT_ID,
    auth0RedirectUri: process.env.AUTH0_REDIRECT_URI
  });
});

export default router;