import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { expressjwt as jwt } from "express-jwt";
import jwksRsa from "jwks-rsa";
import dotenv from "dotenv";
import mongoose from "mongoose";
import marketplaceRouter from "./routes/marketplace.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err.message));

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

app.use("/api/marketplace", checkJwt, marketplaceRouter);

app.get("/api/test", checkJwt, (req, res) => {
  res.json({ success: true, user: req.auth, message: "JWT verified!" });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.use((err, req, res, next) => {
  if (err.name === "UnauthorizedError") {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
  res.status(err.status || 500).json({ success: false, message: err.message });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));