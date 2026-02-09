import express from "express";
import path from "path";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

/* ================= MongoDB ================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

/* ================= Middleware ================= */
app.use(cors());
app.use(express.json());

/* ================= Serve Frontend ================= */
app.use(express.static(path.resolve("./dist")));

app.get("*", (req, res) => {
  res.sendFile(path.resolve("./dist/index.html"));
});

/* ================= Start Server ================= */
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));