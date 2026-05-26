// routes/seller.routes.js
import express    from "express";
import multer     from "multer";
import { authRequired }       from "../middleware/auth.js";
import { attachVendor }       from "../middleware/vendorGuard.js";
import {
  setupStore,
  submitVerification,
  getVendorStatus,
}                             from "../controllers/seller.controller.js";

const router = express.Router();

// ── Multer — memory storage, send buffers to Cloudinary ──────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB max per file
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, WebP and PDF files allowed"));
    }
  },
});

// ── Store setup file fields ────────────────────────────────────
const storeUpload = upload.fields([
  { name: "store_logo",   maxCount: 1 },
  { name: "store_banner", maxCount: 1 },
]);

// ── Verification doc fields ────────────────────────────────────
const verifyUpload = upload.fields([
  { name: "id_card",       maxCount: 1 },
  { name: "selfie",        maxCount: 1 },
  { name: "business_doc",  maxCount: 1 },
  { name: "address_proof", maxCount: 1 },
]);

// ── Routes ─────────────────────────────────────────────────────

// GET  /api/seller/status
// Returns vendor status + permissions for logged-in user
router.get(
  "/status",
  authRequired,
  getVendorStatus
);

// POST /api/seller/setup-store
// Creates or updates vendor store record
router.post(
  "/setup-store",
  authRequired,
  storeUpload,
  setupStore
);

// POST /api/seller/verify
// Submits verification documents
router.post(
  "/verify",
  authRequired,
  verifyUpload,
  submitVerification
);

export default router;