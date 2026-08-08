// middleware/upload.js

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import multer  from "multer";
import sharp   from "sharp";
import crypto  from "crypto";

/* ── R2 Client ── */
const r2 = new S3Client({
  region     : process.env.R2_REGION ?? "auto",
  endpoint   : process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId    : process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET     = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

/* ── Multer ── */
export const upload = multer({
  storage   : multer.memoryStorage(),
  limits    : { fileSize: 10 * 1024 * 1024 }, // 10 MB raw
  fileFilter(_req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Only JPEG, PNG, WEBP and AVIF are allowed"));
  },
});

/* ── Compress single image ── */
async function compressImage(buffer) {
  return sharp(buffer)
    .rotate()                          // fix EXIF orientation
    .resize({
      width             : 1200,
      height            : 1200,
      fit               : "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 75, effort: 4 })
    .toBuffer();
}

/* ── Upload single buffer to R2 ── */
async function putToR2(buffer, folder = "products") {
  const key = `${folder}/${crypto.randomUUID()}.webp`;

  await r2.send(
    new PutObjectCommand({
      Bucket      : R2_BUCKET,
      Key         : key,
      Body        : buffer,
      ContentType : "image/webp",
      CacheControl: "public, max-age=31536000",
    })
  );

  return {
    key,
    public_url: `${R2_PUBLIC_URL}/${key}`,
  };
}

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT
   Step 1 — compress ALL images in parallel   (CPU bound)
   Step 2 — upload  ALL images in parallel    (network bound)
   Separating them lets Sharp use all cores before
   any network round-trips begin.
══════════════════════════════════════════════════════════════ */
export async function processAndUploadImages(files, folder = "products") {
  if (!files?.length) return [];

  /* Step 1: compress all in parallel */
  const compressed = await Promise.all(
    files.map((f) => compressImage(f.buffer))
  );

  /* Step 2: upload all in parallel */
  const uploaded = await Promise.all(
    compressed.map((buf) => putToR2(buf, folder))
  );

  return uploaded; // [{ key, public_url }]
}

/* ── Delete single file from R2 ── */
export async function deleteFromR2(key) {
  if (!key) return;
  try {
    await r2.send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })
    );
  } catch (err) {
    console.error("R2 delete failed:", key, err?.message);
  }
}