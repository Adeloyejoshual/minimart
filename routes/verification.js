// ════════════════════════════════════════════════════════════
// FILE: routes/verification.js — v3
//
// POST /api/verification/send-email-otp
// POST /api/verification/verify-email-otp
// POST /api/verification/face-check
// POST /api/verification/submit
// GET  /api/verification/status
//
// ── Security layers ──────────────────────────────────────────
//  Layer 1  Application-level duplicate check (SELECT before INSERT)
//  Layer 2  DB unique partial index on document_number_hash
//  Layer 3  23505 handler converts constraint violation → 409
//  Layer 4  OTPs bcrypt-hashed — plaintext never stored
//  Layer 5  Document numbers HMAC-SHA256 hashed (keyed, normalised)
//  Layer 6  Rate limiters + attempt caps + account flagging
//  Layer 7  Email verified before identity submission allowed
//  Layer 8  Server-side face match (InsightFace / FaceNet)
//  Layer 9  Hard block on definitive face mismatch
//  Layer 10 Atomic transaction — identity + store or nothing
// ─────────────────────────────────────────────────────────────

import express   from "express";
import bcrypt    from "bcrypt";
import crypto    from "crypto";
import multer    from "multer";
import path      from "path";
import rateLimit from "express-rate-limit";

import { pool }         from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { writeAudit }   from "../lib/audit.js";
import {
  sendVerificationEmail,
  sendWelcomeEmail,
} from "../services/email.js";
import { reactivateLimitedListings } from "./addproduct.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ══════════════════════════════════════════════════════════════
   STARTUP DIAGNOSTICS
══════════════════════════════════════════════════════════════ */
console.log("[verification] module loaded  NODE_ENV:", process.env.NODE_ENV);
console.log(
  "[verification] RESEND_API_KEY :",
  process.env.RESEND_API_KEY
    ? `SET …${process.env.RESEND_API_KEY.slice(-4)}`
    : "❌ NOT SET"
);
console.log(
  "[verification] DOC_HASH_SECRET:",
  process.env.DOC_HASH_SECRET
    ? `SET …${process.env.DOC_HASH_SECRET.slice(-4)}`
    : "❌ NOT SET — duplicate detection DISABLED"
);
console.log(
  "[verification] FACE_SERVICE   :",
  process.env.FACE_SERVICE_URL || "❌ NOT SET — face-check skipped"
);

/* ══════════════════════════════════════════════════════════════
   POLICY
══════════════════════════════════════════════════════════════ */
const POLICY = Object.freeze({
  DAILY_SEND_LIMIT     : IS_PROD ?  3 : 50,
  RESEND_COOLDOWN_SECS : IS_PROD ? 60 : 30,
  OTP_EXPIRY_MINUTES   : 10,
  MAX_VERIFY_ATTEMPTS  : IS_PROD ?  5 : 10,
  ABUSE_WINDOW_MINUTES : 10,
  ABUSE_THRESHOLD      : IS_PROD ?  5 : 40,
  BCRYPT_ROUNDS        : 10,
});

/* ══════════════════════════════════════════════════════════════
   TRUST SCORE
   email_verified    → 30 pts
   identity_verified → 35 pts
   store_verified    → 20 pts
   account > 30 days → 10 pts
   account > 90 days →  5 pts
   cap               → 100 pts
══════════════════════════════════════════════════════════════ */
const computeTrustScore = (user) => {
  let s = 0;
  if (user.email_verified)    s += 30;
  if (user.identity_verified) s += 35;
  if (user.store_verified)    s += 20;
  const age = (Date.now() - new Date(user.created_at).getTime()) / 86_400_000;
  if (age > 30) s += 10;
  if (age > 90) s +=  5;
  return Math.min(s, 100);
};

/* ══════════════════════════════════════════════════════════════
   FILE POLICY
══════════════════════════════════════════════════════════════ */
const DOC_MIME  = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const IMG_MIME  = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_MIME  = {
  ".jpg"  : "image/jpeg",
  ".jpeg" : "image/jpeg",
  ".png"  : "image/png",
  ".webp" : "image/webp",
  ".pdf"  : "application/pdf",
};

const MAX_DOC_BYTES  = 5 * 1_048_576;   /* 5 MB */
const MAX_LOGO_BYTES = 2 * 1_048_576;   /* 2 MB */
const MAX_LV_BYTES   = 3 * 1_048_576;   /* 3 MB */

const VALID_DOC_TYPES = new Set([
  "nin",
  "passport",
  "drivers_license",
  "voters_card",
]);

/* ══════════════════════════════════════════════════════════════
   DOCUMENT NUMBER VALIDATORS
   Server-side regex mirrors frontend DOC_RULES.
   Server is the authority — frontend rules are UX hints only.
══════════════════════════════════════════════════════════════ */
const DOC_VALIDATORS = {
  nin             : (v) => /^\d{11}$/.test(v.replace(/\s/g, "")),
  passport        : (v) => /^[A-Za-z]\d{8}$/.test(v.replace(/\s/g, "")),
  drivers_license : (v) => /^[A-Za-z]{3}\d{6}[A-Za-z]{2}$/.test(v.replace(/[\s-]/g, "")),
  voters_card     : (v) => /^[A-Za-z0-9]{19}$/.test(v.replace(/\s/g, "")),
};

/* ══════════════════════════════════════════════════════════════
   MULTER
══════════════════════════════════════════════════════════════ */
const memStore = multer.memoryStorage();

const makeFilter = (allowed) => (_req, file, cb) => {
  if (allowed.has(file.mimetype)) return cb(null, true);
  const err = new Error(
    `Invalid file type "${file.mimetype}". Allowed: ${[...allowed].join(", ")}.`
  );
  err.code = "INVALID_MIME";
  cb(err);
};

/*
 * uploadSubmit — handles all 5 possible files in POST /submit:
 *   doc_front, doc_back, selfie, store_logo, liveness_frame
 */
const uploadSubmit = multer({
  storage    : memStore,
  limits     : { fileSize: MAX_DOC_BYTES, files: 5 },
  fileFilter : (_req, file, cb) => {
    const all = new Set([...DOC_MIME, ...IMG_MIME]);
    if (all.has(file.mimetype)) return cb(null, true);
    const err = new Error(`Invalid file type "${file.mimetype}".`);
    err.code  = "INVALID_MIME";
    cb(err);
  },
}).fields([
  { name: "doc_front",      maxCount: 1 },
  { name: "doc_back",       maxCount: 1 },
  { name: "selfie",         maxCount: 1 },
  { name: "store_logo",     maxCount: 1 },
  { name: "liveness_frame", maxCount: 1 },
]);

const uploadFaceCheck = multer({
  storage    : memStore,
  limits     : { fileSize: MAX_DOC_BYTES, files: 2 },
  fileFilter : makeFilter(IMG_MIME),
}).fields([
  { name: "selfie",    maxCount: 1 },
  { name: "doc_front", maxCount: 1 },
]);

const withUpload = (handler) => (req, res, next) =>
  handler(req, res, (err) => {
    if (!err) return next();
    const known = [
      "LIMIT_FILE_SIZE",
      "LIMIT_FILE_COUNT",
      "INVALID_MIME",
    ].includes(err.code);
    return known
      ? res.status(400).json({ success: false, message: err.message })
      : next(err);
  });

/* ══════════════════════════════════════════════════════════════
   CLOUDINARY — lazy-loaded, cached
══════════════════════════════════════════════════════════════ */
let _cld = null;
let _sf  = null;

async function getCld() {
  if (_cld) return _cld;
  const {
    CLOUDINARY_CLOUD_NAME : cn,
    CLOUDINARY_API_KEY    : ak,
    CLOUDINARY_API_SECRET : as,
  } = process.env;

  if (!cn || !ak || !as) {
    console.warn("[cloudinary] not configured — placeholder URLs in use");
    return null;
  }

  try {
    const { v2: cld } = await import("cloudinary");
    const sf           = await import("streamifier");
    cld.config({ cloud_name: cn, api_key: ak, api_secret: as, secure: true });
    _cld = cld;
    _sf  = sf.default ?? sf;
    console.log("[cloudinary] ready");
    return _cld;
  } catch (e) {
    console.error("[cloudinary] init failed:", e.message);
    return null;
  }
}

const uploadBuffer = async (buffer, folder, userId, opts = {}) => {
  const cld = await getCld();
  if (!cld) {
    return { secure_url: `local://${folder}/${userId}/${Date.now()}` };
  }
  return new Promise((ok, no) => {
    const s = cld.uploader.upload_stream(
      {
        folder          : `loemart/verification/${folder}/${userId}`,
        resource_type   : "auto",
        allowed_formats : ["jpg", "jpeg", "png", "webp", "pdf"],
        overwrite       : false,
        unique_filename : true,
        ...opts,
      },
      (e, r) => (e ? no(new Error(`Cloudinary: ${e.message}`)) : ok(r))
    );
    _sf.createReadStream(buffer).pipe(s);
  });
};

/* ══════════════════════════════════════════════════════════════
   FACE MATCH SERVICE
   Calls FACE_SERVICE_URL/compare — expects JSON response:
     { match: bool, confidence: 0-1, message: string }

   If FACE_SERVICE_URL is not set, returns skipped:true so the
   submission still proceeds but is flagged for manual review.

   ── Example InsightFace Python micro-service (FastAPI) ──────
   from fastapi import FastAPI, File, UploadFile
   from insightface.app import FaceAnalysis
   from scipy.spatial.distance import cosine
   import numpy as np, cv2

   app  = FastAPI()
   fa   = FaceAnalysis(providers=["CPUExecutionProvider"])
   fa.prepare(ctx_id=0)

   @app.post("/compare")
   async def compare(selfie: UploadFile, doc_front: UploadFile):
       def embed(b):
           a = np.frombuffer(b, np.uint8)
           faces = fa.get(cv2.imdecode(a, cv2.IMREAD_COLOR))
           return faces[0].embedding if faces else None

       e1, e2 = embed(await selfie.read()), embed(await doc_front.read())
       if e1 is None or e2 is None:
           return {"match": False, "confidence": 0, "message": "No face detected"}
       sim = float(1 - cosine(e1, e2))
       return {"match": sim > 0.40, "confidence": round(sim, 3), "message": "OK"}
   ─────────────────────────────────────────────────────────────
══════════════════════════════════════════════════════════════ */
const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL ?? null;

const compareFaces = async (selfieBuffer, docFrontBuffer) => {
  if (!FACE_SERVICE_URL) {
    console.warn("[face-check] FACE_SERVICE_URL not set — skipping");
    return {
      match      : null,
      confidence : null,
      skipped    : true,
      message    : "Face service not configured",
    };
  }

  try {
    const fd = new FormData();
    fd.append("selfie",    new Blob([selfieBuffer]),   "selfie.jpg");
    fd.append("doc_front", new Blob([docFrontBuffer]), "doc_front.jpg");

    const r = await fetch(`${FACE_SERVICE_URL}/compare`, {
      method : "POST",
      body   : fd,
      signal : AbortSignal.timeout(15_000),
    });

    if (!r.ok) throw new Error(`Face service ${r.status}`);
    const d = await r.json();

    return {
      match      : Boolean(d.match),
      confidence : d.confidence ?? null,
      skipped    : false,
      message    : d.message ?? "OK",
    };
  } catch (e) {
    console.error("[face-check] service error:", e.message);
    return {
      match      : null,
      confidence : null,
      skipped    : true,
      message    : e.message,
    };
  }
};

/* ══════════════════════════════════════════════════════════════
   RATE LIMITERS
══════════════════════════════════════════════════════════════ */
const makeLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs        : windowMin * 60 * 1_000,
    max,
    standardHeaders : true,
    legacyHeaders   : false,
    keyGenerator    : (req) => String(req.user?.id ?? req.ip),
    handler         : (_req, res) =>
      res.status(429).json({ success: false, message }),
  });

const sendOtpLimiter = makeLimiter({
  windowMin : 10,
  max       : IS_PROD ?  5 : 50,
  message   : "Too many send requests. Please wait.",
});

const verifyOtpLimiter = makeLimiter({
  windowMin : 15,
  max       : IS_PROD ? 10 : 50,
  message   : "Too many verification attempts.",
});

const submitLimiter = makeLimiter({
  windowMin : 60,
  max       : IS_PROD ?  5 : 30,
  message   : "Too many submissions. Please wait.",
});

const faceCheckLimiter = makeLimiter({
  windowMin : 15,
  max       : IS_PROD ? 20 : 100,
  message   : "Too many face checks. Please wait.",
});

/* ══════════════════════════════════════════════════════════════
   PURE HELPERS
══════════════════════════════════════════════════════════════ */
const generateOtp = () => crypto.randomInt(100_000, 999_999).toString();
const getIp       = (req) => req.ip ?? req.socket?.remoteAddress ?? null;
const maskEmail   = (e) =>
  String(e).replace(/(.{2})(.*)(@.*)/, (_, a, _b, c) => `${a}***${c}`);
const getTodayUTC = () => new Date().toISOString().slice(0, 10);
const fail        = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const makeDeviceHash = (req) =>
  crypto
    .createHash("sha256")
    .update(
      [
        req.headers["user-agent"]      ?? "",
        req.headers["accept-language"] ?? "",
        req.headers["sec-ch-ua"]       ?? "",
      ].join("|")
    )
    .digest("hex");

const extMatchesMime = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  return EXT_MIME[ext] === file.mimetype;
};

const getDailySendCount = async (db, userId) => {
  const today     = getTodayUTC();
  const { rows }  = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM   email_verifications
     WHERE  user_id    = $1
       AND  created_at >= $2::date
       AND  created_at <  ($2::date + INTERVAL '1 day')`,
    [userId, today]
  );
  return parseInt(rows[0].cnt, 10);
};

const flagAccount = async (db, userId, reason, ip) => {
  await db.query(
    `UPDATE users
     SET    status        = 'flagged',
            total_reports = COALESCE(total_reports, 0) + 1,
            updated_at    = NOW()
     WHERE  id = $1`,
    [userId]
  );
  writeAudit({
    actorId    : userId,
    action     : "user_flagged",
    targetType : "user",
    targetId   : userId,
    metadata   : { reason },
    ipAddress  : ip,
  }).catch(() => {});
};

const refreshTrustScore = async (client, userId) => {
  const { rows } = await client.query(
    `SELECT email_verified, identity_verified, store_verified, created_at
     FROM   users WHERE id = $1`,
    [userId]
  );
  if (!rows.length) return 0;
  const score = computeTrustScore(rows[0]);
  await client.query(
    "UPDATE users SET trust_score = $1, updated_at = NOW() WHERE id = $2",
    [score, userId]
  );
  return score;
};

/* ══════════════════════════════════════════════════════════════
   DOCUMENT NUMBER HASHING
   HMAC-SHA256, keyed with DOC_HASH_SECRET, normalised, type-prefixed.

   Properties:
   ─ Deterministic  : same input → same hash always
   ─ Non-reversible : hash → input is infeasible
   ─ Secret-keyed   : DB dump alone cannot brute-force numbers
   ─ Normalised     : "12345" == "12 345" == "12-345"
   ─ Type-prefixed  : "nin:123" ≠ "passport:123"

   Defence in depth:
   ─ Layer 1 (application): SELECT before INSERT catches common case
   ─ Layer 2 (database):    UNIQUE partial index catches race condition
   ─ Layer 3 (handler):     23505 → clean 409 response
══════════════════════════════════════════════════════════════ */
const DOC_HASH_SECRET = process.env.DOC_HASH_SECRET ?? null;

const hashDocNumber = (docType, docNumber) => {
  if (!DOC_HASH_SECRET) return null;
  const norm    = String(docNumber)
    .toLowerCase()
    .replace(/[\s\-_]/g, "")
    .trim();
  const payload = `${docType.toLowerCase()}:${norm}`;
  return crypto
    .createHmac("sha256", DOC_HASH_SECRET)
    .update(payload)
    .digest("hex");
};

/* ══════════════════════════════════════════════════════════════
   POST /api/verification/send-email-otp
══════════════════════════════════════════════════════════════ */
router.post(
  "/send-email-otp",
  authenticate,
  sendOtpLimiter,
  async (req, res) => {
    const userId = req.user?.id;
    const ip     = getIp(req);

    if (!userId) return fail(res, 401, "Not authenticated.");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /* ── Fetch and lock user row ── */
      const { rows: users } = await client.query(
        `SELECT id, email, name, email_verified, status
         FROM   users
         WHERE  id = $1
         FOR UPDATE`,
        [userId]
      );
      if (!users.length) {
        await client.query("ROLLBACK");
        return fail(res, 404, "User not found.");
      }

      const user = users[0];

      if (user.email_verified) {
        await client.query("ROLLBACK");
        return fail(res, 400, "Email already verified.");
      }
      if (user.status === "flagged" || user.status === "banned") {
        await client.query("ROLLBACK");
        return fail(res, 403, "Account restricted. Contact support.");
      }

      /* ── Daily send limit ── */
      const dailyCount = await getDailySendCount(client, userId);
      if (dailyCount >= POLICY.DAILY_SEND_LIMIT) {
        await client.query("ROLLBACK");
        return fail(
          res, 429,
          `Daily limit (${POLICY.DAILY_SEND_LIMIT}/day). Try tomorrow.`,
          { remaining: 0 }
        );
      }

      /* ── Resend cooldown ── */
      const { rows: recent } = await client.query(
        `SELECT created_at
         FROM   email_verifications
         WHERE  user_id    = $1
           AND  created_at > NOW() - ($2 || ' seconds')::INTERVAL
         ORDER  BY created_at DESC
         LIMIT  1`,
        [userId, POLICY.RESEND_COOLDOWN_SECS]
      );
      if (recent.length) {
        const wait = Math.ceil(
          POLICY.RESEND_COOLDOWN_SECS -
          (Date.now() - new Date(recent[0].created_at).getTime()) / 1_000
        );
        await client.query("ROLLBACK");
        return fail(
          res, 429,
          `Wait ${wait}s before requesting another code.`,
          { retryAfter: wait, remaining: POLICY.DAILY_SEND_LIMIT - dailyCount }
        );
      }

      /* ── Abuse detection ── */
      const { rows: abr } = await client.query(
        `SELECT COUNT(*) AS cnt
         FROM   email_verifications
         WHERE  user_id    = $1
           AND  created_at > NOW() - ($2 || ' minutes')::INTERVAL`,
        [userId, POLICY.ABUSE_WINDOW_MINUTES]
      );
      if (parseInt(abr[0].cnt, 10) >= POLICY.ABUSE_THRESHOLD) {
        await flagAccount(client, userId, "otp_abuse", ip);
        await client.query("COMMIT");
        return fail(res, 429, "Account flagged for suspicious activity.");
      }

      /* ── Expire previous active OTPs ── */
      await client.query(
        `UPDATE email_verifications
         SET    status  = 'expired',
                used_at = NOW()
         WHERE  user_id = $1
           AND  status  = 'active'`,
        [userId]
      );

      /* ── Generate, hash, insert ── */
      const otp    = generateOtp();
      const hash   = await bcrypt.hash(otp, POLICY.BCRYPT_ROUNDS);
      const device = makeDeviceHash(req);

      await client.query(
        `INSERT INTO email_verifications
           (user_id, otp_hash, expires_at, status, device_hash, ip_address)
         VALUES ($1, $2, NOW() + ($3 || ' minutes')::INTERVAL, 'active', $4, $5)`,
        [userId, hash, POLICY.OTP_EXPIRY_MINUTES, device, ip]
      );

      /* ── Upsert device fingerprint ── */
      await client.query(
        `INSERT INTO user_devices
           (user_id, device_hash, ip_address, user_agent, last_seen)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (user_id, device_hash) DO UPDATE
           SET last_seen = NOW(), ip_address = EXCLUDED.ip_address`,
        [userId, device, ip, req.headers["user-agent"] ?? null]
      );

      await client.query("COMMIT");

      /* ── Send email (after commit so OTP exists if email fails slowly) ── */
      try {
        await sendVerificationEmail({ to: user.email, name: user.name, otp });
      } catch (mailErr) {
        /* Roll back the OTP record so user can retry immediately */
        pool.query(
          `UPDATE email_verifications
           SET    status = 'expired', used_at = NOW()
           WHERE  user_id    = $1
             AND  status     = 'active'
             AND  created_at > NOW() - INTERVAL '2 minutes'`,
          [userId]
        ).catch(() => {});
        return fail(res, 500, `Email failed: ${mailErr.message}`);
      }

      const remaining = POLICY.DAILY_SEND_LIMIT - (dailyCount + 1);

      writeAudit({
        actorId    : userId,
        action     : "otp_sent",
        targetType : "user",
        targetId   : userId,
        metadata   : { remaining },
        ipAddress  : ip,
      }).catch(() => {});

      return res.json({
        success   : true,
        message   : "Verification code sent.",
        email     : maskEmail(user.email),
        expiresIn : POLICY.OTP_EXPIRY_MINUTES * 60,
        remaining,
        ...(IS_PROD ? {} : { dev_otp: otp }),
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[send-otp] error:", err.message);
      return fail(res, 500, "Server error. Please try again.");
    } finally {
      client.release();
    }
  }
);

/* ══════════════════════════════════════════════════════════════
   POST /api/verification/verify-email-otp
══════════════════════════════════════════════════════════════ */
router.post(
  "/verify-email-otp",
  authenticate,
  verifyOtpLimiter,
  async (req, res) => {
    const rawOtp = String(req.body?.otp ?? "").trim();
    const userId = req.user?.id;
    const ip     = getIp(req);

    if (!userId)                 return fail(res, 401, "Not authenticated.");
    if (!/^\d{6}$/.test(rawOtp)) return fail(res, 400, "OTP must be exactly 6 digits.");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `SELECT id, otp_hash, attempts
         FROM   email_verifications
         WHERE  user_id    = $1
           AND  status     = 'active'
           AND  expires_at > NOW()
         ORDER  BY created_at DESC
         LIMIT  1`,
        [userId]
      );

      if (!rows.length) {
        await client.query("ROLLBACK");
        return fail(res, 400, "Code expired or not found. Request a new one.");
      }

      const rec = rows[0];

      /* Attempt cap */
      if (rec.attempts >= POLICY.MAX_VERIFY_ATTEMPTS) {
        await client.query(
          "UPDATE email_verifications SET status = 'blocked' WHERE id = $1",
          [rec.id]
        );
        await flagAccount(client, userId, "otp_max_attempts", ip);
        await client.query("COMMIT");
        return fail(res, 429, "Too many failed attempts. Account flagged.");
      }

      const valid = await bcrypt.compare(rawOtp, rec.otp_hash);

      if (!valid) {
        await client.query(
          "UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1",
          [rec.id]
        );
        await client.query("COMMIT");
        const left = Math.max(0, POLICY.MAX_VERIFY_ATTEMPTS - 1 - rec.attempts);
        return fail(res, 400, "Incorrect code.", { attemptsLeft: left });
      }

      /* Atomic mark-used — prevents replay between concurrent requests */
      const { rows: marked } = await client.query(
        `UPDATE email_verifications
         SET    status = 'used', used_at = NOW()
         WHERE  id     = $1
           AND  status = 'active'
         RETURNING id`,
        [rec.id]
      );
      if (!marked.length) {
        await client.query("ROLLBACK");
        return fail(res, 400, "Code already used. Request a new one.");
      }

      /* Mark user email verified */
      await client.query(
        `UPDATE users
         SET    email_verified    = TRUE,
                email_verified_at = NOW(),
                verified          = TRUE,
                updated_at        = NOW()
         WHERE  id = $1`,
        [userId]
      );

      const trustScore = await refreshTrustScore(client, userId);
      await client.query("COMMIT");

      /* Fire-and-forget post-verification tasks */
      reactivateLimitedListings(userId).catch((e) =>
        console.error("[verify-otp] reactivate:", e.message)
      );

      writeAudit({
        actorId    : userId,
        action     : "email_verified",
        targetType : "user",
        targetId   : userId,
        metadata   : { trust_score: trustScore },
        ipAddress  : ip,
      }).catch(() => {});

      pool
        .query("SELECT email, name FROM users WHERE id = $1", [userId])
        .then(({ rows: u }) => {
          if (u[0]) sendWelcomeEmail({ to: u[0].email, name: u[0].name }).catch(() => {});
        })
        .catch(() => {});

      return res.json({
        success     : true,
        message     : "Email verified successfully.",
        trust_score : trustScore,
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[verify-otp] error:", err.message);
      return fail(res, 500, "Server error. Please try again.");
    } finally {
      client.release();
    }
  }
);

/* ══════════════════════════════════════════════════════════════
   POST /api/verification/face-check
   Standalone pre-check — frontend calls whenever selfie + doc
   front are both ready, before the main submit.
   Result is advisory only at this point; the definitive check
   runs again server-side inside POST /submit.
══════════════════════════════════════════════════════════════ */
router.post(
  "/face-check",
  authenticate,
  faceCheckLimiter,
  withUpload(uploadFaceCheck),
  async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 401, "Not authenticated.");

    const selfieFile   = req.files?.selfie?.[0]    ?? null;
    const docFrontFile = req.files?.doc_front?.[0] ?? null;

    if (!selfieFile)   return fail(res, 400, "Selfie required.");
    if (!docFrontFile) return fail(res, 400, "Document front required.");

    try {
      const result = await compareFaces(selfieFile.buffer, docFrontFile.buffer);
      return res.json({
        success    : true,
        match      : result.match,
        confidence : result.confidence,
        skipped    : result.skipped ?? false,
        message    : result.message,
      });
    } catch (err) {
      console.error("[face-check] error:", err.message);
      /*
       * Never block the frontend on a face-check failure.
       * The definitive check is inside POST /submit.
       */
      return res.json({
        success : true,
        match   : null,
        skipped : true,
        message : "Face check unavailable.",
      });
    }
  }
);

/* ══════════════════════════════════════════════════════════════
   POST /api/verification/submit
   Atomic: identity + store inserted in a single DB transaction.
   Either both succeed or nothing is persisted.

   Three-layer duplicate document defence:
     Layer 1 — SELECT before INSERT (application check)
     Layer 2 — UNIQUE partial index on document_number_hash
               catches the race condition Layer 1 misses
     Layer 3 — 23505 error code handler → clean 409 response

   Server-side face match runs here (authoritative).
   If the face service is unavailable (skipped), submission
   proceeds but is flagged for manual face review.
   If the face service returns match=false, submission is blocked.
══════════════════════════════════════════════════════════════ */
router.post(
  "/submit",
  authenticate,
  submitLimiter,
  withUpload(uploadSubmit),
  async (req, res) => {
    const userId = req.user?.id;
    const ip     = getIp(req);

    console.log("\n[submit] ▶ userId:", userId);
    if (!userId) return fail(res, 401, "Not authenticated.");

    /* ── Parse body ── */
    const docType       = (req.body.document_type     ?? "").trim();
    const docNumber     = (req.body.document_number   ?? "").trim();
    const storeName     = (req.body.store_name        ?? "").trim();
    const storeDesc     = (req.body.store_description ?? "").trim();
    const livenessPassed = req.body.liveness_passed   === "true";

    /* ── Validate document type ── */
    if (!VALID_DOC_TYPES.has(docType)) {
      return fail(
        res, 400,
        `Invalid document type. Allowed: ${[...VALID_DOC_TYPES].join(", ")}.`
      );
    }

    /* ── Validate document number — server is the authority ── */
    const validateNum = DOC_VALIDATORS[docType];
    if (!validateNum || !validateNum(docNumber)) {
      return fail(
        res, 400,
        `Invalid ${docType.replace(/_/g, " ")} number format.`
      );
    }

    /* ── Validate store fields ── */
    if (storeName.length < 2)   return fail(res, 400, "Store name too short (min 2).");
    if (storeName.length > 60)  return fail(res, 400, "Store name too long (max 60).");
    if (storeDesc.length > 300) return fail(res, 400, "Description too long (max 300).");

    /* ── Validate required files ── */
    const frontFile  = req.files?.doc_front?.[0]      ?? null;
    const backFile   = req.files?.doc_back?.[0]       ?? null;
    const selfieFile = req.files?.selfie?.[0]          ?? null;
    const logoFile   = req.files?.store_logo?.[0]      ?? null;
    const lvFile     = req.files?.liveness_frame?.[0]  ?? null;

    if (!frontFile)  return fail(res, 400, "Document front required.");
    if (!backFile)   return fail(res, 400, "Document back required.");
    if (!selfieFile) return fail(res, 400, "Selfie required.");

    /* ── Extension ↔ MIME validation ── */
    for (const f of [frontFile, backFile, selfieFile]) {
      if (!extMatchesMime(f)) {
        return fail(
          res, 400,
          `File "${f.originalname}" extension does not match its content.`
        );
      }
    }

    /* ── Hash document number ── */
    const docHash = hashDocNumber(docType, docNumber);
    if (!docHash) {
      console.warn("[submit] DOC_HASH_SECRET missing — duplicate detection disabled");
    }

    /* ── Guard queries — run in parallel for speed ── */
    const [userRes, pendingIdRes, pendingStRes, dupRes] = await Promise.all([
      pool.query(
        `SELECT email_verified, identity_verified, store_verified, status
         FROM   users WHERE id = $1`,
        [userId]
      ),

      /* Layer 1a: existing identity review */
      pool.query(
        `SELECT id, status
         FROM   identity_verifications
         WHERE  user_id = $1
           AND  status  IN ('pending', 'approved')
         LIMIT  1`,
        [userId]
      ),

      /* Layer 1b: existing store review */
      pool.query(
        `SELECT id, status
         FROM   store_verifications
         WHERE  user_id = $1
           AND  status  IN ('pending', 'approved')
         LIMIT  1`,
        [userId]
      ),

      /*
       * Layer 1 — duplicate document check (application-level).
       * Skipped when hash unavailable (DOC_HASH_SECRET not set).
       * Layer 2 (DB unique index) still protects even if this is skipped.
       */
      docHash
        ? pool.query(
            `SELECT id
             FROM   identity_verifications
             WHERE  document_number_hash = $1
               AND  status IN ('pending', 'approved')
             LIMIT  1`,
            [docHash]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    /* ── Evaluate guards ── */
    const user = userRes.rows[0];
    if (!user) return fail(res, 404, "User not found.");

    if (user.status === "flagged" || user.status === "banned")
      return fail(res, 403, "Account restricted. Contact support.");

    if (!user.email_verified)
      return fail(res, 403, "Verify your email address before submitting documents.");

    if (user.identity_verified)
      return fail(res, 400, "Identity already verified.");

    if (pendingIdRes.rows.length) {
      return fail(
        res, 409,
        pendingIdRes.rows[0].status === "approved"
          ? "Identity already verified."
          : "You already have a pending identity review."
      );
    }

    if (pendingStRes.rows.length) {
      return fail(
        res, 409,
        pendingStRes.rows[0].status === "approved"
          ? "Store already verified."
          : "You already have a pending store review."
      );
    }

    if (dupRes.rows.length) {
      /* Audit the duplicate attempt before rejecting */
      writeAudit({
        actorId    : userId,
        action     : "identity_duplicate_rejected",
        targetType : "user",
        targetId   : userId,
        metadata   : { document_type: docType },
        ipAddress  : ip,
      }).catch(() => {});

      return fail(
        res, 409,
        "This document is already registered on our platform. " +
        "If you believe this is an error, contact support."
      );
    }

    /* ── Server-side face match (authoritative) ── */
    const faceResult = await compareFaces(selfieFile.buffer, frontFile.buffer);
    console.log("[submit] face match result:", {
      match      : faceResult.match,
      confidence : faceResult.confidence,
      skipped    : faceResult.skipped,
    });

    /*
     * Hard block on definitive mismatch.
     * If the service is unavailable (skipped), allow submission
     * but flag it for manual face review via face_skipped column.
     */
    if (!faceResult.skipped && faceResult.match === false) {
      writeAudit({
        actorId    : userId,
        action     : "verification_face_mismatch",
        targetType : "user",
        targetId   : userId,
        metadata   : { confidence: faceResult.confidence },
        ipAddress  : ip,
      }).catch(() => {});

      return fail(
        res, 422,
        "Selfie does not match the document photo. " +
        "Please retake both photos in good lighting and try again."
      );
    }

    /* ── Upload all files in parallel ── */
    let front, back, selfie, logo, liveness;
    try {
      [front, back, selfie, logo, liveness] = await Promise.all([
        uploadBuffer(frontFile.buffer,  "id_documents",  userId),
        uploadBuffer(backFile.buffer,   "id_documents",  userId),
        uploadBuffer(selfieFile.buffer, "selfies",       userId),
        logoFile
          ? uploadBuffer(logoFile.buffer, "store_logos",    userId)
          : Promise.resolve(null),
        lvFile
          ? uploadBuffer(lvFile.buffer,  "liveness_frames", userId)
          : Promise.resolve(null),
      ]);
    } catch (uploadErr) {
      console.error("[submit] upload error:", uploadErr.message);
      return fail(res, 500, `File upload failed: ${uploadErr.message}`);
    }

    /* ── Atomic DB transaction — identity + store ── */
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO identity_verifications
           (user_id,
            document_type,
            document_number_hash,
            front_image_url,
            back_image_url,
            selfie_url,
            liveness_frame_url,
            liveness_passed,
            face_match,
            face_confidence,
            face_skipped,
            status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')`,
        [
          userId,
          docType,
          docHash ?? null,
          front.secure_url,
          back.secure_url,
          selfie.secure_url,
          liveness?.secure_url ?? null,
          livenessPassed,
          faceResult.match,
          faceResult.confidence,
          faceResult.skipped,
        ]
      );

      await client.query(
        `INSERT INTO store_verifications
           (user_id, store_name, store_description, logo_url, status)
         VALUES ($1,$2,$3,$4,'pending')`,
        [userId, storeName, storeDesc || null, logo?.secure_url ?? null]
      );

      await client.query("COMMIT");
      console.log("[submit] ✓ committed  userId:", userId);

    } catch (dbErr) {
      await client.query("ROLLBACK").catch(() => {});

      /*
       * Layer 3 — unique index violation.
       * Two concurrent requests with the same document both passed
       * the Layer 1 SELECT (neither row existed yet), but only one
       * INSERT won. The second hits the unique index (23505).
       */
      if (dbErr.code === "23505") {
        return fail(
          res, 409,
          "This document is already registered on our platform. " +
          "If you believe this is an error, contact support."
        );
      }

      console.error("[submit] db error:", dbErr.message, dbErr.stack);
      return fail(res, 500, "Submission failed. Please try again.");

    } finally {
      client.release();
    }

    /* ── Audit ── */
    writeAudit({
      actorId    : userId,
      action     : "verification_submitted",
      targetType : "user",
      targetId   : userId,
      metadata   : {
        document_type   : docType,
        store_name      : storeName,
        liveness_passed : livenessPassed,
        face_match      : faceResult.match,
        face_confidence : faceResult.confidence,
        face_skipped    : faceResult.skipped,
      },
      ipAddress  : ip,
    }).catch(() => {});

    return res.status(202).json({
      success : true,
      message :
        "Documents submitted. Our team will review within 24 hours. " +
        "You'll be notified when your account is verified.",
    });
  }
);

/* ══════════════════════════════════════════════════════════════
   GET /api/verification/status
══════════════════════════════════════════════════════════════ */
router.get("/status", authenticate, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return fail(res, 401, "Not authenticated.");

  try {
    const [userRes, idRes, storeRes, limitedRes] = await Promise.all([

      pool.query(
        `SELECT id, email, name, role, seller_type, status,
                email_verified, email_verified_at,
                identity_verified, store_verified,
                trust_score, created_at
         FROM   users
         WHERE  id = $1`,
        [userId]
      ),

      /* Latest identity review — includes face match metadata */
      pool.query(
        `SELECT document_type,
                status,
                rejection_reason,
                face_match,
                face_confidence,
                face_skipped,
                liveness_passed,
                updated_at
         FROM   identity_verifications
         WHERE  user_id = $1
         ORDER  BY created_at DESC
         LIMIT  1`,
        [userId]
      ),

      /* Latest store review */
      pool.query(
        `SELECT status,
                rejection_reason AS message,
                updated_at
         FROM   store_verifications
         WHERE  user_id = $1
         ORDER  BY created_at DESC
         LIMIT  1`,
        [userId]
      ),

      /* Limited listings — nudge user to verify */
      pool.query(
        `SELECT COUNT(*)          AS cnt,
                MIN(active_until) AS soonest
         FROM   products
         WHERE  seller_id    = $1
           AND  status       = 'active_limited'
           AND  (active_until IS NULL OR active_until > NOW())`,
        [userId]
      ),
    ]);

    if (!userRes.rows.length) return fail(res, 404, "User not found.");

    const user         = userRes.rows[0];
    const idReview     = idRes.rows[0]    ?? null;
    const storeReview  = storeRes.rows[0] ?? null;
    const dailyCount   = await getDailySendCount(pool, userId);
    const limitedCount = parseInt(limitedRes.rows[0].cnt, 10);
    const soonest      = limitedRes.rows[0].soonest ?? null;
    const daysLeft     = soonest
      ? Math.max(
          0,
          Math.ceil((new Date(soonest).getTime() - Date.now()) / 86_400_000)
        )
      : null;

    return res.json({
      success           : true,

      /* Identity */
      email             : maskEmail(user.email),
      name              : user.name,
      role              : user.role,
      seller_type       : user.seller_type,
      status            : user.status,

      /* Verification flags */
      email_verified    : user.email_verified,
      email_verified_at : user.email_verified_at,
      identity_verified : user.identity_verified,
      store_verified    : user.store_verified,

      /* Review details */
      identity_review   : idReview,
      store_review      : storeReview,

      /* Trust */
      trust_score       : user.trust_score ?? 0,

      /* OTP limits */
      resend_remaining  : Math.max(0, POLICY.DAILY_SEND_LIMIT - dailyCount),
      resend_limit      : POLICY.DAILY_SEND_LIMIT,

      /* Motivational nudge — limited listings near expiry */
      limited_listings  : {
        count          : limitedCount,
        soonest_expiry : soonest,
        days_remaining : daysLeft,
        message        : limitedCount > 0
          ? `${limitedCount} listing${limitedCount !== 1 ? "s" : ""} will expire ` +
            `in ${daysLeft ?? "?"} day${daysLeft !== 1 ? "s" : ""}. ` +
            "Complete identity verification to make them permanent."
          : null,
      },

      /* What verification unlocks */
      upgrade_benefits  : user.identity_verified
        ? null
        : {
            daily_limit  : 100,
            active_limit : 500,
            no_expiry    : true,
            message      :
              "Verify your identity to unlock 100 products/day, " +
              "500 active listings, and permanent listings with no expiry.",
          },
    });

  } catch (err) {
    console.error("[status] error:", err.message);
    return fail(res, 500, "Server error. Please try again.");
  }
});

export default router;