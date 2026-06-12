// routes/address.js

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

// ─────────────────────────────────────────────────────────────
// HELPER — fetch one address belonging to this user
// ─────────────────────────────────────────────────────────────
async function findAddress(id, userId) {
  const { rows } = await pool.query(
    `SELECT * FROM public.user_addresses
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────
// HELPER — unset all defaults for a user
// ─────────────────────────────────────────────────────────────
async function clearDefaults(userId, client = pool) {
  await client.query(
    `UPDATE public.user_addresses
     SET    is_default = false,
            updated_at = now()
     WHERE  user_id = $1`,
    [userId]
  );
}

// ═════════════════════════════════════════════════════════════
// GET /api/checkout/address/zones
// Public — no auth needed
// Returns all delivery zones
// ═════════════════════════════════════════════════════════════
router.get("/zones", (_req, res) => {
  return res.json({
    success: true,
    data:    DELIVERY_ZONES,
  });
});

// ═════════════════════════════════════════════════════════════
// GET /api/checkout/address
// Returns all saved addresses for the logged-in buyer
// Ordered: default first, then newest first
// ═════════════════════════════════════════════════════════════
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         id,
         label,
         recipient_name,
         phone,
         state,
         city,
         address_line,
         landmark,
         additional_directions,
         call_before_delivery,
         is_default,
         created_at,
         updated_at
       FROM   public.user_addresses
       WHERE  user_id = $1
       ORDER  BY is_default DESC, created_at DESC`,
      [req.user.id]
    );

    return res.json({
      success: true,
      data:    rows,
    });

  } catch (err) {
    console.error("[GET /address]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch addresses",
    });
  }
});

// ═════════════════════════════════════════════════════════════
// GET /api/checkout/address/:id
// Returns a single address belonging to the user
// ═════════════════════════════════════════════════════════════
router.get("/:id", async (req, res) => {
  try {
    const address = await findAddress(req.params.id, req.user.id);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    return res.json({
      success: true,
      data:    address,
    });

  } catch (err) {
    console.error("[GET /address/:id]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch address",
    });
  }
});

// ═════════════════════════════════════════════════════════════
// POST /api/checkout/address
// Create a new delivery address
// Body: full address object
// ═════════════════════════════════════════════════════════════
router.post("/", async (req, res) => {
  // ── Normalise ─────────────────────────────────────────────
  const data = normalizeAddress(req.body);

  // ── Validate ──────────────────────────────────────────────
  const validation = validateAddress(data);
  if (!validation.valid) {
    return res.status(422).json({
      success: false,
      message: "Please fix the errors below",
      errors:  validation.errors,
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Unset other defaults if this will be default ───────
    if (data.is_default) {
      await clearDefaults(req.user.id, client);
    }

    // ── Insert ────────────────────────────────────────────
    const { rows: [address] } = await client.query(
      `INSERT INTO public.user_addresses
         (user_id,
          label,
          recipient_name,
          phone,
          state,
          city,
          address_line,
          landmark,
          additional_directions,
          call_before_delivery,
          is_default,
          created_at,
          updated_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
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
        data.additional_directions ?? "",
        data.call_before_delivery  ?? false,
        data.is_default            ?? false,
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Address saved successfully",
      data:    address,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[POST /address]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to save address",
    });
  } finally {
    client.release();
  }
});

// ═════════════════════════════════════════════════════════════
// PATCH /api/checkout/address/:id
// Update an existing address (partial update supported)
// Only updates fields that are present in the request body
// ═════════════════════════════════════════════════════════════
router.patch("/:id", async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  // ── Normalise incoming data ───────────────────────────────
  const data   = normalizeAddress(req.body);
  const errors = {};

  // ── Field-level validation (only for provided fields) ─────
  if (req.body.state !== undefined) {
    if (!data.state?.trim()) {
      errors.state = "State is required";
    } else if (!isStateAllowed(data.state)) {
      errors.state = `We don't deliver to ${data.state} yet`;
    }
  }

  if (req.body.city !== undefined) {
    if (!data.city?.trim()) {
      errors.city = "City is required";
    } else if (data.state && !isCityAllowed(data.state, data.city)) {
      errors.city = "We don't deliver to this city yet";
    }
  }

  if (
    req.body.landmark !== undefined &&
    data.landmark !== undefined &&
    data.landmark.trim().length > 0 &&
    data.landmark.trim().length < 5
  ) {
    errors.landmark = "Please provide a more specific landmark";
  }

  if (
    req.body.phone !== undefined &&
    data.phone &&
    !/^[0-9]{10,11}$/.test(data.phone.replace(/\s/g, ""))
  ) {
    errors.phone = "Enter a valid Nigerian phone number";
  }

  if (Object.keys(errors).length) {
    return res.status(422).json({
      success: false,
      message: "Please fix the errors below",
      errors,
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Verify address belongs to user ────────────────────
    const existing = await findAddress(id, userId);
    if (!existing) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // ── If setting as default, clear others first ─────────
    if (data.is_default === true) {
      await clearDefaults(userId, client);
    }

    // ── Update — COALESCE keeps existing value if null ────
    const { rows: [updated] } = await client.query(
      `UPDATE public.user_addresses
       SET
         label                 = COALESCE($2,  label),
         recipient_name        = COALESCE($3,  recipient_name),
         phone                 = COALESCE($4,  phone),
         state                 = COALESCE($5,  state),
         city                  = COALESCE($6,  city),
         address_line          = COALESCE($7,  address_line),
         landmark              = COALESCE($8,  landmark),
         additional_directions = COALESCE($9,  additional_directions),
         call_before_delivery  = COALESCE($10, call_before_delivery),
         is_default            = COALESCE($11, is_default),
         updated_at            = now()
       WHERE  id      = $1
         AND  user_id = $12
       RETURNING *`,
      [
        id,
        // Only pass value if field was in request body
        // otherwise pass null so COALESCE keeps existing
        req.body.label                 !== undefined ? data.label                 : null,
        req.body.recipient_name        !== undefined ? data.recipient_name        : null,
        req.body.phone                 !== undefined ? data.phone                 : null,
        req.body.state                 !== undefined ? data.state                 : null,
        req.body.city                  !== undefined ? data.city                  : null,
        req.body.address_line          !== undefined ? data.address_line          : null,
        req.body.landmark              !== undefined ? data.landmark              : null,
        req.body.additional_directions !== undefined ? data.additional_directions : null,
        req.body.call_before_delivery  !== undefined
          ? (data.call_before_delivery ?? false)
          : null,
        req.body.is_default !== undefined
          ? (data.is_default ?? false)
          : null,
        userId,
      ]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Address updated successfully",
      data:    updated,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[PATCH /address/:id]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update address",
    });
  } finally {
    client.release();
  }
});

// ═════════════════════════════════════════════════════════════
// PUT /api/checkout/address/:id
// Full replacement update (same logic as PATCH)
// Kept for frontend compatibility
// ═════════════════════════════════════════════════════════════
router.put("/:id", async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  // ── Normalise + full validation ───────────────────────────
  const data       = normalizeAddress(req.body);
  const validation = validateAddress(data);

  if (!validation.valid) {
    return res.status(422).json({
      success: false,
      message: "Please fix the errors below",
      errors:  validation.errors,
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Verify address belongs to user ────────────────────
    const existing = await findAddress(id, userId);
    if (!existing) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // ── Clear defaults if setting this as default ─────────
    if (data.is_default) {
      await clearDefaults(userId, client);
    }

    // ── Full update ───────────────────────────────────────
    const { rows: [updated] } = await client.query(
      `UPDATE public.user_addresses
       SET
         label                 = $2,
         recipient_name        = $3,
         phone                 = $4,
         state                 = $5,
         city                  = $6,
         address_line          = $7,
         landmark              = $8,
         additional_directions = $9,
         call_before_delivery  = $10,
         is_default            = $11,
         updated_at            = now()
       WHERE  id      = $1
         AND  user_id = $12
       RETURNING *`,
      [
        id,
        data.label,
        data.recipient_name,
        data.phone,
        data.state,
        data.city,
        data.address_line,
        data.landmark,
        data.additional_directions ?? "",
        data.call_before_delivery  ?? false,
        data.is_default            ?? false,
        userId,
      ]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Address updated successfully",
      data:    updated,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[PUT /address/:id]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update address",
    });
  } finally {
    client.release();
  }
});

// ═════════════════════════════════════════════════════════════
// DELETE /api/checkout/address/:id
// Delete a saved address
// Cannot delete the only address if it is selected at checkout
// ═════════════════════════════════════════════════════════════
router.delete("/:id", async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    // ── Check address exists + belongs to user ────────────
    const existing = await findAddress(id, userId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    await pool.query(
      `DELETE FROM public.user_addresses
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    // ── If we deleted the default, promote the next one ───
    if (existing.is_default) {
      await pool.query(
        `UPDATE public.user_addresses
         SET    is_default = true,
                updated_at = now()
         WHERE  user_id = $1
           AND  id = (
             SELECT id FROM public.user_addresses
             WHERE  user_id = $1
             ORDER  BY created_at DESC
             LIMIT  1
           )`,
        [userId]
      );
    }

    return res.json({
      success: true,
      message: "Address deleted",
    });

  } catch (err) {
    console.error("[DELETE /address/:id]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to delete address",
    });
  }
});

// ═════════════════════════════════════════════════════════════
// PATCH /api/checkout/address/:id/default
// Set one address as the default
// ═════════════════════════════════════════════════════════════
router.patch("/:id/default", async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Check address exists ──────────────────────────────
    const existing = await findAddress(id, userId);
    if (!existing) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // ── Clear all defaults ────────────────────────────────
    await clearDefaults(userId, client);

    // ── Set this one as default ───────────────────────────
    const { rows: [updated] } = await client.query(
      `UPDATE public.user_addresses
       SET    is_default = true,
              updated_at = now()
       WHERE  id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Default address updated",
      data:    updated,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[PATCH /address/:id/default]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update default",
    });
  } finally {
    client.release();
  }
});

export default router;