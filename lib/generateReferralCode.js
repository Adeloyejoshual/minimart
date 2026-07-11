// lib/generateReferralCode.js

import crypto from "crypto";
import { pool } from "../config/db.js";

/**
 * Generates unique referral codes.
 *
 * Format:
 * - 8 uppercase alphanumeric characters
 * - Example: LM8F3K2P
 *
 * Character set:
 * - A-Z
 * - 0-9
 *
 * Total combinations:
 * 36^8 = 2,821,109,907,456 (~2.8 trillion)
 */

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 8;

/**
 * Generate a cryptographically secure referral code.
 */
export function generateCode(length = CODE_LENGTH) {
  let code = "";

  for (let i = 0; i < length; i++) {
    code += CHARSET[crypto.randomInt(CHARSET.length)];
  }

  return code;
}

/**
 * Generate a referral code that does not already exist.
 *
 * NOTE:
 * The users.referral_code column MUST have a UNIQUE constraint.
 * This function reduces collisions, while the database guarantees uniqueness.
 */
export async function generateUniqueReferralCode(maxAttempts = 10) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const code = generateCode();

    const { rowCount } = await pool.query(
      `
      SELECT 1
      FROM users
      WHERE referral_code = $1
      LIMIT 1
      `,
      [code]
    );

    if (rowCount === 0) {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[Referral] Generated unique code: ${code} (Attempt ${attempt}/${maxAttempts})`
        );
      }

      return code;
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[Referral] Collision detected: ${code} (Attempt ${attempt}/${maxAttempts})`
      );
    }
  }

  throw new Error(
    `Unable to generate a unique referral code after ${maxAttempts} attempts.`
  );
}