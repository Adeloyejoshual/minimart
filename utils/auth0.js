// utils/auth.js
import { expressjwt as jwt } from "express-jwt";
import jwksRsa from "jwks-rsa";

export const verifyJwt = jwt({
  // Dynamically provide a signing key based on the kid in the header and the JWKS endpoint
  secret: jwksRsa.expressJwtSecret({
    cache: true,               // cache the signing key
    rateLimit: true,           // prevent abuse
    jwksRequestsPerMinute: 5,  // limit requests to JWKS endpoint
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  }),
  audience: process.env.AUTH0_AUDIENCE,  // the API identifier you set in Auth0
  issuer: `https://${process.env.AUTH0_DOMAIN}/`, // the issuer URL from Auth0
  algorithms: ["RS256"],  // JWT signing algorithm
});