import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

/* ── Multer: memory storage (buffers go straight to Cloudinary) ── */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 }, // 5 MB · 5 files
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(Object.assign(new Error("Only image files are allowed"), { status: 415 }), false);
  },
});

/* ── Stream a buffer to Cloudinary and resolve with the result ── */
export const uploadToCloudinary = (buffer, folder = "minimart/products") =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image", quality: "auto", fetch_format: "auto" },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    Readable.from(buffer).pipe(stream);
  });
