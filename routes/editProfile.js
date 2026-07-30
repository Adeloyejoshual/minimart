// routes/editProfile.js

import express from "express";
import multer from "multer";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import { pool } from "../server.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// CLOUDFLARE R2 CLIENT
// ═══════════════════════════════════════════════════════════════
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET      = process.env.R2_BUCKET_NAME;
const PUBLIC_URL  = process.env.R2_PUBLIC_URL; // e.g. https://images.loemart.com

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const MAX_FILE_BYTES  = 5 * 1024 * 1024; // 5 MB
const MIN_DIMENSION   = 100;             // px
const MAX_BIO         = 200;
const MAX_STORE_DESC  = 300;
const MAX_NAME        = 60;
const MAX_STORE_NAME  = 60;
const MAX_USERNAME    = 20;

/* ✅ Username can be changed once every 30 days */
const USERNAME_COOLDOWN_DAYS = 30;

// ═══════════════════════════════════════════════════════════════
// MULTER — memory storage, image only, 5 MB limit
// ═══════════════════════════════════════════════════════════════
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, or WebP images are allowed."));
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

// Safely trim string or return null
const clean = (val) =>
  val !== undefined && val !== null && String(val).trim() !== ""
    ? String(val).trim()
    : null;

// Strip any keys that are undefined (so PATCH only updates what was sent)
const defined = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// Extract R2 key from a full URL
// e.g. https://images.loemart.com/avatars/abc.jpg → avatars/abc.jpg
const keyFromUrl = (url) => {
  if (!url || !PUBLIC_URL) return null;
  try {
    const base = PUBLIC_URL.endsWith("/") ? PUBLIC_URL : PUBLIC_URL + "/";
    return url.startsWith(base) ? url.slice(base.length) : null;
  } catch {
    return null;
  }
};

// Delete old image from R2 (fire-and-forget — never blocks response)
const deleteFromR2 = (url) => {
  const key = keyFromUrl(url);
  if (!key) return;
  r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
    .catch((e) => console.error("[R2 delete]", key, e.message));
};

/* ═══════════════════════════════════════════════════════════════
   USERNAME COOLDOWN HELPER
   Returns { canChange, daysLeft, nextChangeAt, lastChangedAt, cooldownDays }
═══════════════════════════════════════════════════════════════ */
const getUsernameCooldown = (usernameChangedAt) => {
  if (!usernameChangedAt) {
    return {
      canChange:     true,
      daysLeft:      0,
      nextChangeAt:  null,
      lastChangedAt: null,
      cooldownDays:  USERNAME_COOLDOWN_DAYS,
    };
  }

  const lastChange   = new Date(usernameChangedAt);
  const nextChangeAt = new Date(lastChange);
  nextChangeAt.setDate(nextChangeAt.getDate() + USERNAME_COOLDOWN_DAYS);

  const now = new Date();
  if (now >= nextChangeAt) {
    return {
      canChange:     true,
      daysLeft:      0,
      nextChangeAt:  null,
      lastChangedAt: usernameChangedAt,
      cooldownDays:  USERNAME_COOLDOWN_DAYS,
    };
  }

  const msLeft   = nextChangeAt - now;
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

  return {
    canChange:     false,
    daysLeft,
    nextChangeAt,
    lastChangedAt: usernameChangedAt,
    cooldownDays:  USERNAME_COOLDOWN_DAYS,
  };
};

// Build the exact profile shape the frontend expects
const formatProfile = (row) => {
  const cooldown = getUsernameCooldown(row.username_changed_at);

  return {
    id:                row.id,
    name:              row.name              ?? "",
    username:          row.username          ?? "",
    email:             row.email             ?? "",
    email_verified:    row.email_verified    ?? false,
    phone:             row.phone_number      ?? "",   // ← DB: phone_number → API: phone
    bio:               row.bio               ?? "",
    profile_image:     row.profile_image     ?? "",
    store_logo:        row.store_logo        ?? "",
    store_name:        row.store_name        ?? "",
    store_description: row.store_description ?? "",
    store_category:    row.store_category    ?? "",
    business_hours:    row.business_hours    ?? {},
    location: {                                       // ← nested for frontend
      state: row.state   ?? "",
      city:  row.city    ?? "",
    },
    // Flat versions too so frontend fallback works
    location_state:    row.state             ?? "",
    location_city:     row.city              ?? "",
    // Extra fields used by other parts of the app
    store_verified:    row.store_verified    ?? false,
    status:            row.status            ?? "active",
    role:              row.role              ?? "user",
    seller_type:       row.seller_type       ?? "individual",
    identity_verified: row.identity_verified ?? false,
    cover_image:       row.cover_image       ?? "",
    store_banner:      row.store_banner      ?? "",
    store_slug:        row.store_slug        ?? "",
    rating:            row.rating            ?? 0,
    trust_score:       row.trust_score       ?? 0,
    is_premium:        row.is_premium        ?? false,
    created_at:        row.created_at,
    updated_at:        row.updated_at,

    /* ✅ Username change cooldown info for frontend */
    username_cooldown: {
      can_change:      cooldown.canChange,
      days_left:       cooldown.daysLeft,
      next_change_at:  cooldown.nextChangeAt,
      last_changed_at: cooldown.lastChangedAt,
      cooldown_days:   cooldown.cooldownDays,
    },
  };
};

// ═══════════════════════════════════════════════════════════════
// ROUTE 1 — GET /api/edit-profile/me
// Returns full profile for EditProfile page (includes cooldown)
// ═══════════════════════════════════════════════════════════════
router.get("/me", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         id, name, username, email, email_verified,
         phone_number, bio, profile_image, store_logo,
         store_name, store_description, store_category,
         business_hours, state, city, country,
         store_verified, store_slug, store_banner,
         cover_image, status, "role", seller_type,
         identity_verified, rating, trust_score,
         is_premium, username_changed_at,
         created_at, updated_at
       FROM public.users
       WHERE id = $1`,
      [req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(formatProfile(rows[0]));

  } catch (err) {
    console.error("[GET /edit-profile/me]", err.message);
    return res.status(500).json({ message: "Failed to load profile. Please try again." });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROUTE 2 — PATCH /api/edit-profile/me
// Partial update — enforces 30-day username cooldown
// ═══════════════════════════════════════════════════════════════
router.patch("/me", authenticate, async (req, res) => {
  const body = req.body;

  // ── Build allowed field map from request body
  // Only include fields that were actually sent
  const updates = defined({
    name:              body.name              !== undefined ? clean(body.name)              : undefined,
    username:          body.username          !== undefined ? clean(body.username)          : undefined,
    phone_number:      body.phone             !== undefined ? clean(body.phone)             : undefined, // phone → phone_number
    bio:               body.bio               !== undefined ? clean(body.bio)               : undefined,
    profile_image:     body.profile_image     !== undefined ? clean(body.profile_image)     : undefined,
    store_logo:        body.store_logo        !== undefined ? clean(body.store_logo)        : undefined,
    store_name:        body.store_name        !== undefined ? clean(body.store_name)        : undefined,
    store_description: body.store_description !== undefined ? clean(body.store_description) : undefined,
    store_category:    body.store_category    !== undefined ? clean(body.store_category)    : undefined,
    business_hours:    body.business_hours    !== undefined ? body.business_hours           : undefined,
    // location object → flat columns
    state:             body.location?.state   !== undefined ? clean(body.location.state)    : undefined,
    city:              body.location?.city    !== undefined ? clean(body.location.city)     : undefined,
  });

  // ═══════════════════════════════════════════════════════════
  // ✅ USERNAME COOLDOWN CHECK (before validation)
  // ═══════════════════════════════════════════════════════════
  let isUsernameChanging = false;
  let currentUsername    = null;

  if (updates.username !== undefined) {
    try {
      const { rows: userRows } = await pool.query(
        `SELECT username, username_changed_at
         FROM public.users
         WHERE id = $1`,
        [req.user.id]
      );

      if (!userRows[0]) {
        return res.status(404).json({ message: "User not found" });
      }

      currentUsername = userRows[0].username;
      isUsernameChanging =
        updates.username &&
        updates.username.toLowerCase() !== (currentUsername || "").toLowerCase();

      if (isUsernameChanging) {
        const cooldown = getUsernameCooldown(userRows[0].username_changed_at);

        if (!cooldown.canChange) {
          console.log(
            `[edit-profile] username cooldown active for user=${req.user.id} ` +
            `daysLeft=${cooldown.daysLeft}`
          );

          return res.status(429).json({
            message:
              `You can change your username once every ${USERNAME_COOLDOWN_DAYS} days. ` +
              `Try again in ${cooldown.daysLeft} day${cooldown.daysLeft !== 1 ? "s" : ""}.`,
            errors: {
              username:
                `Available in ${cooldown.daysLeft} day${cooldown.daysLeft !== 1 ? "s" : ""}`,
            },
            username_cooldown: {
              can_change:      false,
              days_left:       cooldown.daysLeft,
              next_change_at:  cooldown.nextChangeAt,
              last_changed_at: cooldown.lastChangedAt,
              cooldown_days:   cooldown.cooldownDays,
            },
          });
        }
      }
    } catch (err) {
      console.error("[edit-profile cooldown check]", err.message);
      return res.status(500).json({ message: "Could not verify username eligibility." });
    }
  }

  // ── Validation
  const errors = {};

  if (updates.name !== undefined) {
    if (!updates.name)                    errors.name = "Name is required";
    else if (updates.name.length < 2)     errors.name = "Name must be at least 2 characters";
    else if (updates.name.length > MAX_NAME) errors.name = `Name must be under ${MAX_NAME} characters`;
  }

  if (updates.username !== undefined && updates.username !== null) {
    if (!/^[a-z0-9_]{3,20}$/.test(updates.username))
      errors.username = "Username must be 3–20 characters: letters, numbers, underscores only";
  }

  if (updates.phone_number !== undefined && updates.phone_number !== null) {
    const digits = updates.phone_number.replace(/\s/g, "");
    if (!/^\+?\d{7,15}$/.test(digits))
      errors.phone = "Enter a valid phone number";
    else
      updates.phone_number = digits; // store unformatted
  }

  if (updates.bio !== undefined && updates.bio !== null) {
    if (updates.bio.length > MAX_BIO)
      errors.bio = `Bio must be under ${MAX_BIO} characters`;
  }

  if (updates.store_description !== undefined && updates.store_description !== null) {
    if (updates.store_description.length > MAX_STORE_DESC)
      errors.store_description = `Store description must be under ${MAX_STORE_DESC} characters`;
  }

  if (updates.store_name !== undefined && updates.store_name !== null) {
    if (updates.store_name.length > MAX_STORE_NAME)
      errors.store_name = `Store name must be under ${MAX_STORE_NAME} characters`;
  }

  if (updates.business_hours !== undefined) {
    if (typeof updates.business_hours !== "object" || Array.isArray(updates.business_hours))
      errors.business_hours = "Invalid business hours format";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(422).json({ message: "Validation failed", errors });
  }

  // ── Nothing to update
  if (Object.keys(updates).length === 0) {
    return res.status(200).json({ message: "No changes to save" });
  }

  // ── Build dynamic SET clause
  // e.g. { name: "Chidi", bio: "Hello" }
  // → SET name = $1, bio = $2 WHERE id = $3
  const setClauses = [];
  const values     = [];
  let   paramIndex = 1;

  for (const [col, val] of Object.entries(updates)) {
    if (col === "business_hours") {
      setClauses.push(`${col} = $${paramIndex}::jsonb`);
      values.push(JSON.stringify(val));
    } else {
      setClauses.push(`${col} = $${paramIndex}`);
      values.push(val);
    }
    paramIndex++;
  }

  /* ✅ If username is actually changing, stamp username_changed_at */
  if (isUsernameChanging) {
    setClauses.push(`username_changed_at = NOW()`);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(req.user.id); // last param = WHERE id

  const sql = `
    UPDATE public.users
    SET ${setClauses.join(", ")}
    WHERE id = $${paramIndex}
    RETURNING
      id, name, username, email, email_verified,
      phone_number, bio, profile_image, store_logo,
      store_name, store_description, store_category,
      business_hours, state, city, country,
      store_verified, store_slug, store_banner,
      cover_image, status, "role", seller_type,
      identity_verified, rating, trust_score,
      is_premium, username_changed_at,
      created_at, updated_at
  `;

  try {
    const { rows } = await pool.query(sql, values);

    if (!rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    if (isUsernameChanging) {
      console.log(
        `[edit-profile] username changed for user=${req.user.id} ` +
        `from="${currentUsername}" to="${rows[0].username}"`
      );
    }

    return res.json(formatProfile(rows[0]));

  } catch (err) {
    console.error("[PATCH /edit-profile/me]", err.message);

    if (err.code === "23505") {
      const detail = (err.detail || "").toLowerCase();
      if (detail.includes("username"))
        return res.status(409).json({
          message: "Username already taken",
          field:   "username",
          errors:  { username: "Username already taken" },
        });
      if (detail.includes("phone"))
        return res.status(409).json({
          message: "Phone number already in use",
          field:   "phone",
          errors:  { phone: "Phone number already in use" },
        });
    }

    return res.status(500).json({ message: "Failed to save profile. Please try again." });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROUTE 3 — GET /api/edit-profile/check-username
// Real-time username availability check with cache headers
// ✅ Also returns cooldown status so frontend never wastes a lookup
// ═══════════════════════════════════════════════════════════════
router.get("/check-username", authenticate, async (req, res) => {
  const { username } = req.query;

  // Basic format check before hitting DB
  if (!username || !/^[a-z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({
      available: false,
      message:   "Invalid username format",
    });
  }

  try {
    /* Check cooldown first — no point checking availability if user can't change */
    const { rows: userRows } = await pool.query(
      `SELECT username, username_changed_at
       FROM public.users
       WHERE id = $1`,
      [req.user.id]
    );

    if (!userRows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    const cooldown = getUsernameCooldown(userRows[0].username_changed_at);
    const isSameAsCurrent =
      username.toLowerCase() === (userRows[0].username || "").toLowerCase();

    /* If user is locked and trying a different username, return locked status */
    if (!cooldown.canChange && !isSameAsCurrent) {
      return res.status(200).json({
        available: false,
        username,
        locked:    true,
        message:
          `Username locked. Available in ${cooldown.daysLeft} day${cooldown.daysLeft !== 1 ? "s" : ""}.`,
        username_cooldown: {
          can_change:      false,
          days_left:       cooldown.daysLeft,
          next_change_at:  cooldown.nextChangeAt,
          last_changed_at: cooldown.lastChangedAt,
          cooldown_days:   cooldown.cooldownDays,
        },
      });
    }

    /* Normal availability check */
    const { rows } = await pool.query(
      `SELECT id FROM public.users
       WHERE LOWER(username) = LOWER($1)
       AND id != $2
       LIMIT 1`,
      [username, req.user.id]
    );

    const available = rows.length === 0;

    // Cache for 30s — username availability changes rarely
    res.set("Cache-Control", "private, max-age=30");

    return res.json({ available, username });

  } catch (err) {
    console.error("[GET /check-username]", err.message);
    return res.status(500).json({ message: "Could not check username. Try again." });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROUTE 4 — POST /api/edit-profile/upload/image
// Upload to Cloudflare R2, delete old image if replaced
// ═══════════════════════════════════════════════════════════════
router.post(
  "/upload/image",
  authenticate,
  upload.single("image"),
  async (req, res) => {
    // ── Multer error (file type / size)
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided." });
    }

    try {
      // ── Read dimensions with sharp before uploading
      const metadata = await sharp(req.file.buffer).metadata();

      if (!metadata.width || !metadata.height) {
        return res.status(400).json({ message: "Could not read image dimensions." });
      }

      if (metadata.width < MIN_DIMENSION || metadata.height < MIN_DIMENSION) {
        return res.status(400).json({
          message: `Image must be at least ${MIN_DIMENSION}×${MIN_DIMENSION} px. ` +
                   `Yours is ${metadata.width}×${metadata.height} px.`,
        });
      }

      // ── Convert to JPEG and resize to max 1200px (matches frontend compression)
      const processed = await sharp(req.file.buffer)
        .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 88, progressive: true })
        .toBuffer();

      // ── Unique key: avatars/<userId>/<uuid>.jpg
      const key         = `avatars/${req.user.id}/${uuidv4()}.jpg`;
      const contentType = "image/jpeg";

      // ── Upload to R2
      await r2.send(new PutObjectCommand({
        Bucket:      BUCKET,
        Key:         key,
        Body:        processed,
        ContentType: contentType,
        // Public read so the URL works in <img> tags
        ACL:         "public-read",
        Metadata: {
          uploadedBy:   req.user.id,
          originalName: req.file.originalname || "upload",
        },
      }));

      const url = `${PUBLIC_URL}/${key}`;

      // ── Delete old image if caller passed it
      // Frontend sends old_url in body so we clean up R2 automatically
      const oldUrl = req.body?.old_url;
      if (oldUrl && oldUrl !== url) {
        deleteFromR2(oldUrl); // fire-and-forget
      }

      return res.json({
        url,                  // what frontend stores in profile_image / store_logo
        key,                  // in case frontend needs it
        width:  metadata.width,
        height: metadata.height,
      });

    } catch (err) {
      console.error("[POST /upload/image]", err.message);

      // Sharp errors
      if (err.message?.includes("Input file")) {
        return res.status(400).json({ message: "Invalid or corrupted image file." });
      }

      // R2 errors
      if (err.name === "NoSuchBucket") {
        return res.status(500).json({ message: "Storage bucket not found. Contact support." });
      }

      return res.status(500).json({ message: "Upload failed. Please try again." });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// MULTER ERROR HANDLER (file too large / wrong type)
// Must be defined after routes
// ═══════════════════════════════════════════════════════════════
router.use((err, req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "Image must be under 5 MB." });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err?.message?.includes("Only JPG")) {
    return res.status(415).json({ message: err.message });
  }
  console.error("[editProfile unhandled]", err.message);
  return res.status(500).json({ message: "Something went wrong." });
});

export default router;