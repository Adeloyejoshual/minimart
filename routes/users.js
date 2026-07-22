// ════════════════════════════════════════════════════════════
// FILE: routes/users.js
//
// GET    /api/users/me
// PUT    /api/users/me
// PATCH  /api/users/me/heartbeat
// PATCH  /api/users/me/password
// DELETE /api/users/me
// ════════════════════════════════════════════════════════════

import express  from "express";
import bcrypt   from "bcrypt";
import { pool } from "../server.js";
import { authenticate } from "../middleware/auth.js";

const router      = express.Router();
const SALT_ROUNDS = 12;

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const SAFE_USER_FIELDS = `
  id, name, email, phone_number,
  country, state, city,
  profile_image,
  store_name, store_description, store_logo, store_verified,
  status, last_login,
  rating, trust_score, verified,
  products_count, total_sales, total_purchases,
  created_at, "role",
  is_online, email_verified, identity_verified,
  seller_type, referral_code,
  bonus_spins, total_referrals
`;

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */

// Convert empty strings → null
// Prevents unique constraint crashes on blank phone numbers
const nullIfEmpty = (val) =>
  val && String(val).trim() !== "" ? String(val).trim() : null;

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

/* ════════════════════════════════════════════════════════════
   GET /api/users/me
   Returns the authenticated user's full profile
════════════════════════════════════════════════════════════ */
router.get("/me", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${SAFE_USER_FIELDS}
       FROM   public.users
       WHERE  id = $1`,
      [req.user.id]
    );

    if (!rows[0])
      return fail(res, 404, "User not found.");

    return res.json({ success: true, user: rows[0] });

  } catch (err) {
    console.error("GET /users/me error:", err.message);
    return fail(res, 500, "Failed to fetch user.");
  }
});

/* ════════════════════════════════════════════════════════════
   PUT /api/users/me
   Update editable profile fields.
   - COALESCE keeps the existing value when null is passed
   - phone_number is set directly (null clears it)
════════════════════════════════════════════════════════════ */
router.put("/me", authenticate, async (req, res) => {
  const {
    name,
    phone_number,
    country,
    state,
    city,
    profile_image,
    store_name,
    store_description,
    store_logo,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE public.users
       SET
         name              = COALESCE($1,  name),
         phone_number      = $2,
         country           = COALESCE($3,  country),
         state             = COALESCE($4,  state),
         city              = COALESCE($5,  city),
         profile_image     = COALESCE($6,  profile_image),
         store_name        = COALESCE($7,  store_name),
         store_description = COALESCE($8,  store_description),
         store_logo        = COALESCE($9,  store_logo),
         updated_at        = NOW()
       WHERE  id = $10
       RETURNING ${SAFE_USER_FIELDS}`,
      [
        nullIfEmpty(name),
        nullIfEmpty(phone_number),   // explicit null allowed to clear phone
        nullIfEmpty(country),
        nullIfEmpty(state),
        nullIfEmpty(city),
        nullIfEmpty(profile_image),
        nullIfEmpty(store_name),
        nullIfEmpty(store_description),
        nullIfEmpty(store_logo),
        req.user.id,
      ]
    );

    if (!rows[0])
      return fail(res, 404, "User not found.");

    return res.json({ success: true, user: rows[0] });

  } catch (err) {
    if (
      err.code === "23505" &&
      (err.detail ?? "").toLowerCase().includes("phone")
    ) {
      return fail(res, 409, "Phone number already in use.", {
        code: "PHONE_TAKEN",
      });
    }

    console.error("PUT /users/me error:", err.message);
    return fail(res, 500, "Failed to update profile.");
  }
});

/* ════════════════════════════════════════════════════════════
   PATCH /api/users/me/heartbeat
   Called by the frontend every ~2 minutes while the app is open.
   Keeps last_login fresh so the heartbeat-aware online check in
   conversations.js shows the correct green dot status.

   Online logic (in conversations.js):
     is_online = true AND last_login > NOW() - INTERVAL '5 minutes'

   So if heartbeats stop (tab closed, crash, no signal) the green
   dot disappears automatically within 5 minutes — no cron needed.

   Frontend example:
     const hb = setInterval(() =>
       fetch('/api/users/me/heartbeat', {
         method  : 'PATCH',
         headers : { Authorization: `Bearer ${token}` },
       }), 2 * 60 * 1000
     );

     // On logout / tab close:
     clearInterval(hb);
════════════════════════════════════════════════════════════ */
router.patch("/me/heartbeat", authenticate, async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.users
       SET is_online  = true,
           last_login = NOW()
       WHERE id = $1`,
      [req.user.id]
    );

    return res.json({ success: true });

  } catch (err) {
    console.error("PATCH /users/me/heartbeat error:", err.message);
    return fail(res, 500, "Heartbeat failed.");
  }
});

/* ════════════════════════════════════════════════════════════
   PATCH /api/users/me/password
   Change password.
   - Requires current password so a stolen JWT cannot change it
   - Validates new password strength before hashing
════════════════════════════════════════════════════════════ */
router.patch("/me/password", authenticate, async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password)
    return fail(res, 400, "current_password and new_password are required.");

  if (typeof new_password !== "string" || new_password.length < 8)
    return fail(res, 400, "New password must be at least 8 characters.");

  if (!/[A-Z]/.test(new_password))
    return fail(res, 400,
      "New password must contain at least one uppercase letter."
    );

  if (!/[0-9]/.test(new_password))
    return fail(res, 400,
      "New password must contain at least one number."
    );

  try {
    /* Fetch the current hash — never SELECT * */
    const { rows } = await pool.query(
      `SELECT password_hash FROM public.users WHERE id = $1`,
      [req.user.id]
    );

    if (!rows[0])
      return fail(res, 404, "User not found.");

    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid)
      return fail(res, 401, "Current password is incorrect.");

    const new_hash = await bcrypt.hash(new_password, SALT_ROUNDS);

    await pool.query(
      `UPDATE public.users
       SET password_hash = $1,
           updated_at    = NOW()
       WHERE id = $2`,
      [new_hash, req.user.id]
    );

    return res.json({ success: true, message: "Password updated successfully." });

  } catch (err) {
    console.error("PATCH /users/me/password error:", err.message);
    return fail(res, 500, "Failed to update password.");
  }
});

/* ════════════════════════════════════════════════════════════
   DELETE /api/users/me
   Called on logout.
   Sets is_online = false immediately so the green dot turns off
   right away instead of waiting for the 5-minute heartbeat timeout.
════════════════════════════════════════════════════════════ */
router.delete("/me", authenticate, async (req, res) => {
  try {
    await pool.query(
      `UPDATE public.users
       SET is_online = false
       WHERE id = $1`,
      [req.user.id]
    );

    return res.json({
      success : true,
      message : "Logged out and marked offline.",
    });

  } catch (err) {
    console.error("DELETE /users/me error:", err.message);
    return fail(res, 500, "Logout failed.");
  }
});

export default router;