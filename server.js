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

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://minimart-ivrm.onrender.com', 'https://minimart-ivrm.onrender.com/*']
    : true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

mongoose
  .connect(process.env.MONGO_URI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  }),
  audience: process.env.AUTH0_AUDIENCE,
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
  algorithms: ["RS256"],
});

app.use("/api/marketplace", checkJwt, marketplaceRouter);

app.get("/api/test", checkJwt, (req, res) => {
  res.json({ success: true, user: req.auth, message: "✅ JWT verified!" });
});

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server healthy", timestamp: new Date().toISOString() });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.use((err, req, res, next) => {
  console.error("❌ Error:", err);
  if (err.name === "UnauthorizedError") {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
  res.status(err.status || 500).json({ success: false, message: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Health: http://localhost:${PORT}/api/health`);
});
