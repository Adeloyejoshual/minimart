import { auth } from "express-oauth2-jwt-bearer";

export const checkJwt =
  process.env.AUTH0_DOMAIN && process.env.AUTH0_AUDIENCE
    ? auth({
        audience: process.env.AUTH0_AUDIENCE,
        issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
        tokenSigningAlg: "RS256",
      })
    : (req, res, next) => {
        console.warn("Auth0 not configured");
        return res.status(500).json({
          message: "Auth0 environment variables missing",
        });
      };