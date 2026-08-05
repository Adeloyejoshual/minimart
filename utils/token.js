// utils/token.js
import crypto from "crypto";

// Generate a 6-digit OTP code
export function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash code before saving to DB
export function hashCode(code) {
  return crypto
    .createHash("sha256")
    .update(code)
    .digest("hex");
}