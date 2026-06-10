import express from "express";
import { pool } from "../../config/db.js";
import {
  validateAddress,
  normalizeAddress,
  isStateAllowed,
  isCityAllowed,
  DELIVERY_ZONES,
} from "../../services/location.js";

const router = express.Router();

/* ── GET /zones ── */
router.get("/zones", (_req, res) => {
  res.json({ success: true, data: DELIVERY_ZONES });
});

/* ── GET / — list saved addresses ── */
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
    console.error("[GET address]", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch addresses" });
  }
});

/* ── POST / — create address ── */
router.post("/", async (req, res) => {
  const data = normalizeAddress(req.body);

  const validation = validateAddress(data);
  if (!validation.valid) {
    return res.status(422).json({
      success: false,
      message: "Please fix the errors below",
      errors:  validation.errors,
    });
  }

  try {
    /* Unset other defaults */
    if (data.is_default) {
      await pool.query(
        "UPDATE public.user_addresses SET is_default = false WHERE user_id = $1",
        [req.user.id]
      );
    }

    const { rows: [address] } = await pool.query(
      `INSERT INTO public.user_addresses
         (user_id, label,
          recipient_name, phone,
          state, city,
          address_line, landmark, additional_directions,
          call_before_delivery, is_default)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        req.user.id,
        data.label,
        data.recipient_name,
        data.phone,
        data.state,
        data.city,
        data.address_line,
        data.landmark,
        data.additional_directions,
        data.call_before_delivery,
        data.is_default,
      ]
    );

    res.status(201).json({ success: true, data: address });
  } catch (err) {
    console.error("[POST address]", err.message);
    res.status(500).json({ success: false, message: "Failed to save address" });
  }
});

/* ── PATCH /:id — update address ── */
router.patch("/:id", async (req, res) => {
  const data   = normalizeAddress(req.body);
  const errors = {};

  if (req.body.state !== undefined && !isStateAllowed(data.state))
    errors.state = `We don't deliver to ${data.state} yet`;

  if (
    req.body.city !== undefined &&
    data.state &&
    !isCityAllowed(data.state, data.city)
  )
    errors.city = "Invalid city for selected state";

  if (req.body.landmark !== undefined && data.landmark.length < 5)
    errors.landmark = "Please provide a more specific landmark";

  if (Object.keys(errors).length) {
    return res.status(422).json({ success: false, errors });
  }

  try {
    const { rows: [address] } = await pool.query(
      `UPDATE public.user_addresses SET
         label                 = COALESCE($2,  label),
         recipient_name        = COALESCE($3,  recipient_name),
         phone                 = COALESCE($4,  phone),
         state                 = COALESCE($5,  state),
         city                  = COALESCE($6,  city),
         address_line          = COALESCE($7,  address_line),
         landmark              = COALESCE($8,  landmark),
         additional_directions = COALESCE($9,  additional_directions),
         call_before_delivery  = $10,
         updated_at            = now()
       WHERE id = $1 AND user_id = $11
       RETURNING *`,
      [
        req.params.id,
        data.label           || null,
        data.recipient_name  || null,
        data.phone           || null,
        data.state           || null,
        data.city            || null,
        data.address_line    || null,
        data.landmark        || null,
        data.additional_directions || null,
        data.call_before_delivery,
        req.user.id,
      ]
    );

    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    res.json({ success: true, data: address });
  } catch (err) {
    console.error("[PATCH address]", err.message);
    res.status(500).json({ success: false, message: "Failed to update address" });
  }
});

/* ── DELETE /:id ── */
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
    console.error("[DELETE address]", err.message);
    res.status(500).json({ success: false, message: "Failed to delete address" });
  }
});

/* ── PATCH /:id/default ── */
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
    console.error("[PATCH address/default]", err.message);
    res.status(500).json({ success: false, message: "Failed to update default" });
  }
});

export default router;