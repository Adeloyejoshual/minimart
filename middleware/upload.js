import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DeleteObjectCommand }        from "@aws-sdk/client-s3";
import multer                         from "multer";
import sharp                          from "sharp";
import path                           from "path";
import crypto                         from "crypto";

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

/* ── Multer (memory storage) ── */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits : { fileSize: 10 * 1024 * 1024 }, // 10 MB raw limit
  fileFilter(_req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WEBP and AVIF images are allowed"));
  },
});

/* ── Compress with Sharp ──────────────────────────────────────
   Output: WebP, max 1200px wide, quality 75
   Typical result: < 150 KB per image
─────────────────────────────────────────────────────────────── */
async function compressImage(buffer) {
  return sharp(buffer)
    .rotate()                        // auto-rotate from EXIF
    .resize({
      width  : 1200,
      height : 1200,
      fit    : "inside",             // never upscale, keep aspect ratio
      withoutEnlargement: true,
    })
    .webp({ quality: 75, effort: 4 }) // effort 4 = good speed/size balance
    .toBuffer();
}

/* ── Upload one file to R2 ── */
export async function uploadToR2(file, folder = "products") {
  const compressed  = await compressImage(file.buffer);
  const uniqueName  = `${folder}/${crypto.randomUUID()}.webp`;

  await r2.send(
    new PutObjectCommand({
      Bucket     : R2_BUCKET,
      Key        : uniqueName,
      Body       : compressed,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000", // 1 year CDN cache
    })
  );

  return {
    key       : uniqueName,
    public_url: `${R2_PUBLIC_URL}/${uniqueName}`,
  };
}

/* ── Delete one file from R2 (for rollback) ── */
export async function deleteFromR2(key) {
  await r2.send(
    new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })
  );
}