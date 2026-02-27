// middleware/checkJwt.js

import { auth } from "express-oauth2-jwt-bearer";

if (!process.env.AUTH0_DOMAIN || !process.env.AUTH0_AUDIENCE) {
  throw new Error("AUTH0_DOMAIN and AUTH0_AUDIENCE must be set");
}

export const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  tokenSigningAlg: "RS256",
});