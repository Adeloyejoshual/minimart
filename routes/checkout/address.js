import express from "express";
import { pool } from "../../config/db.js";
import {
  validateAddress,
  normalizeAddress,
  isStateAllowed,
  isCityAllowed,
  getCitiesForState,
  getLGAsForCity,
  ALLOWED_STATES,
  DELIVERY_ZONES,
} from "../../services/location.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════════
   GET /api/checkout/address/zones
   Returns all allowed delivery zones for the frontend dropdowns.
   Called once on page load — builds state/city/lga dropdowns.
══════════════════════════════════════════════════════════════ */
router.get("/zones", (_req, res) => {
  res.json({
    success: true,
    data:    DELIVERY_ZONES,
  });
});

/* ══════════════════════════════════════════════════════════════
   GET /api/checkout/address
   List saved addresses for logged-in buyer.
══════════════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.user_addresses
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("[GET /api/checkout/address]", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch addresses" });
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/checkout/address
   Add a new address.
   All city/state values must come from the controlled zones list.
   Landmark is required.
══════════════════════════════════════════════════════════════ */
router.post("/", async (req, res) => {
  /* Normalize input */
  const data = normalizeAddress(req.body);

  /* Validate */
  const validation = validateAddress(data);
  if (!validation.valid) {
    return res.status(422).json({
      success: false,
      message: "Please fix the errors below",
      errors:  validation.errors,
    });
  }

  try {
    /* Unset other defaults if this is default */
    if (data.is_default) {
      await pool.query(
        "UPDATE public.user_addresses SET is_default = false WHERE user_id = $1",
        [req.user.id]
      );
    }

    const { rows: [address] } = await pool.query(
      `INSERT INTO public.user_addresses
         (user_id, label, recipient_name, phone,
          address_line, landmark, city, state, lga, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        req.user.id,
        data.label,
        data.recipient_name,
        data.phone,
        data.address_line,
        data.landmark,
        data.city,
        data.state,
        data.lga || null,
        data.is_default,
      ]
    );

    res.status(201).json({ success: true, data: address });
  } catch (err) {
    console.error("[POST /api/checkout/address]", err.message);
    res.status(500).json({ success: false, message: "Failed to save address" });
  }
});

/* ══════════════════════════════════════════════════════════════
   PATCH /api/checkout/address/:id
   Update an existing address.
══════════════════════════════════════════════════════════════ */
router.patch("/:id", async (req, res) => {
  const data = normalizeAddress(req.body);

  /* Partial validation — only validate what's provided */
  const errors = {};

  if (req.body.state !== undefined && !isStateAllowed(data.state))
    errors.state = `We don't deliver to ${data.state} yet`;

  if (req.body.city !== undefined && data.state && !isCityAllowed(data.state, data.city))
    errors.city = `We don't deliver to ${data.city} yet`;

  if (req.body.landmark !== undefined && !data.landmark)
    errors.landmark = "Landmark is required";

  if (Object.keys(errors).length) {
    return res.status(422).json({ success: false, errors });
  }

  try {
    const { rows: [address] } = await pool.query(
      `UPDATE public.user_addresses SET
         label          = COALESCE($2,  label),
         recipient_name = COALESCE($3,  recipient_name),
         phone          = COALESCE($4,  phone),
         address_line   = COALESCE($5,  address_line),
         landmark       = COALESCE($6,  landmark),
         city           = COALESCE($7,  city),
         state          = COALESCE($8,  state),
         lga            = COALESCE($9,  lga),
         updated_at     = now()
       WHERE id = $1 AND user_id = $10
       RETURNING *`,
      [
        req.params.id,
        data.label          || null,
        data.recipient_name || null,
        data.phone          || null,
        data.address_line   || null,
        data.landmark       || null,
        data.city           || null,
        data.state          || null,
        data.lga            || null,
        req.user.id,
      ]
    );

    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    res.json({ success: true, data: address });
  } catch (err) {
    console.error("[PATCH /api/checkout/address/:id]", err.message);
    res.status(500).json({ success: false, message: "Failed to update address" });
  }
});

/* ══════════════════════════════════════════════════════════════
   DELETE /api/checkout/address/:id
══════════════════════════════════════════════════════════════ */
router.delete("/:id", async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM public.user_addresses WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );

    if (!rowCount) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    res.json({ success: true, message: "Address deleted" });
  } catch (err) {
    console.error("[DELETE /api/checkout/address/:id]", err.message);
    res.status(500).json({ success: false, message: "Failed to delete address" });
  }
});

/* ══════════════════════════════════════════════════════════════
   PATCH /api/checkout/address/:id/default
══════════════════════════════════════════════════════════════ */
router.patch("/:id/default", async (req, res) => {
  try {
    await pool.query(
      "UPDATE public.user_addresses SET is_default = false WHERE user_id = $1",
      [req.user.id]
    );

    const { rowCount } = await pool.query(
      "UPDATE public.user_addresses SET is_default = true WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );

    if (!rowCount) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    res.json({ success: true, message: "Default address updated" });
  } catch (err) {
    console.error("[PATCH /api/checkout/address/:id/default]", err.message);
    res.status(500).json({ success: false, message: "Failed to update default" });
  }
});

export default router;