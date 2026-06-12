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
// HELPERS
// ─────────────────────────────────────────────────────────────
async function findAddress(id, userId) {
  const { rows } = await pool.query(
    `SELECT * FROM public.user_addresses
     WHERE  id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] ?? null;
}

async function clearDefaults(userId, client = pool) {
  await client.query(
    `UPDATE public.user_addresses
     SET    is_default = false,
            updated_at = now()
     WHERE  user_id = $1`,
    [userId]
  );
}

// ── Format row for response ───────────────────────────────────
// Always returns bus_stop field (sourced from landmark column)
// so frontend always gets the same shape
function formatAddress(row) {
  if (!row) return null;
  return {
    ...row,
    bus_stop: row.bus_stop ?? row.landmark ?? "",
  };
}

// ─────────────────────────────────────────────────────────────
// NORMALISE INCOMING BODY
// Accepts bus_stop OR landmark from frontend
// Always stores in landmark column (existing DB column)
// Also stores in bus_stop column if it exists
// ─────────────────────────────────────────────────────────────
function normalizeBusStop(body) {
  return (
    body.bus_stop?.trim()  ||
    body.landmark?.trim()  ||
    ""
  );
}

// ═════════════════════════════════════════════════════════════
// GET /api/checkout/address/zones
// ═════════════════════════════════════════════════════════════
router.get("/zones", (_req, res) => {
  return res.json({
    success: true,
    data:    DELIVERY_ZONES,
  });
});

// ═════════════════════════════════════════════════════════════
// GET /api/checkout/address
// All addresses for logged-in buyer
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
         -- Return bus_stop column if it exists,
         -- otherwise fall back to landmark
         COALESCE(bus_stop, landmark, '')  AS bus_stop,
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
// ═════════════════════════════════════════════════════════════
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         *,
         COALESCE(bus_stop, landmark, '') AS bus_stop
       FROM  public.user_addresses
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    return res.json({
      success: true,
      data:    rows[0],
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
// Create a new address
// Accepts bus_stop OR landmark — stored in both columns
// ═════════════════════════════════════════════════════════════
router.post("/", async (req, res) => {
  const data     = normalizeAddress(req.body);
  const busStop  = normalizeBusStop(req.body);

  // ── Validate bus stop ─────────────────────────────────────
  if (!busStop) {
    return res.status(422).json({
      success: false,
      message: "Please fix the errors below",
      errors:  { bus_stop: "Nearest bus stop is required" },
    });
  }

  if (busStop.length < 5) {
    return res.status(422).json({
      success: false,
      message: "Please fix the errors below",
      errors:  {
        bus_stop: "Enter a real bus stop name (e.g. Oja Oba bus stop)",
      },
    });
  }

  // ── Full address validation ───────────────────────────────
  data.landmark = busStop; // pass through validator
  const validation = validateAddress(data);
  if (!validation.valid) {
    return res.status(422).json({
      success: false,
      message: "Please fix the errors below",
      errors:  validation.errors,
    });
  }

  // ── Max address check ─────────────────────────────────────
  const { rows: [{ count }] } = await pool.query(
    `SELECT COUNT(*) FROM public.user_addresses WHERE user_id = $1`,
    [req.user.id]
  );
  if (Number(count) >= 3) {
    return res.status(400).json({
      success: false,
      message: "Maximum 3 addresses allowed. Delete one to add a new address.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (data.is_default) {
      await clearDefaults(req.user.id, client);
    }

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
          bus_stop,
          additional_directions,
          call_before_delivery,
          is_default,
          created_at,
          updated_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11, now(), now())
       RETURNING
         *,
         COALESCE(bus_stop, landmark, '') AS bus_stop`,
      [
        req.user.id,
        data.label                 ?? "Home",
        data.recipient_name,
        data.phone,
        data.state,
        data.city,
        data.address_line,
        busStop,                   // $8 → both landmark AND bus_stop
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
// Partial update — only fields present in body are changed
// ═════════════════════════════════════════════════════════════
router.patch("/:id", async (req, res) => {
  const userId  = req.user.id;
  const { id }  = req.params;
  const data    = normalizeAddress(req.body);
  const errors  = {};

  // ── Field-level validation ────────────────────────────────
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

  // Validate bus_stop if provided (either field name)
  const hasBusStop =
    req.body.bus_stop !== undefined ||
    req.body.landmark !== undefined;

  const busStop = hasBusStop ? normalizeBusStop(req.body) : null;

  if (hasBusStop) {
    if (!busStop) {
      errors.bus_stop = "Bus stop is required";
    } else if (busStop.length < 5) {
      errors.bus_stop =
        "Enter a real bus stop (e.g. Oja Oba bus stop)";
    }
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

    const existing = await findAddress(id, userId);
    if (!existing) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    if (data.is_default === true) {
      await clearDefaults(userId, client);
    }

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
         bus_stop              = COALESCE($8,  bus_stop),
         additional_directions = COALESCE($9,  additional_directions),
         call_before_delivery  = COALESCE($10, call_before_delivery),
         is_default            = COALESCE($11, is_default),
         updated_at            = now()
       WHERE  id      = $1
         AND  user_id = $12
       RETURNING
         *,
         COALESCE(bus_stop, landmark, '') AS bus_stop`,
      [
        id,
        req.body.label                 !== undefined ? data.label                 : null,
        req.body.recipient_name        !== undefined ? data.recipient_name        : null,
        req.body.phone                 !== undefined ? data.phone                 : null,
        req.body.state                 !== undefined ? data.state                 : null,
        req.body.city                  !== undefined ? data.city                  : null,
        req.body.address_line          !== undefined ? data.address_line          : null,
        hasBusStop                                   ? busStop                    : null,
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
// Full replacement — kept for frontend compatibility
// ═════════════════════════════════════════════════════════════
router.put("/:id", async (req, res) => {
  const userId  = req.user.id;
  const { id }  = req.params;
  const data    = normalizeAddress(req.body);
  const busStop = normalizeBusStop(req.body);

  // ── Validate bus stop ─────────────────────────────────────
  if (!busStop || busStop.length < 5) {
    return res.status(422).json({
      success: false,
      message: "Please fix the errors below",
      errors:  {
        bus_stop: busStop
          ? "Enter a more specific bus stop name"
          : "Nearest bus stop is required",
      },
    });
  }

  data.landmark = busStop;
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

    const existing = await findAddress(id, userId);
    if (!existing) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    if (data.is_default) {
      await clearDefaults(userId, client);
    }

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
         bus_stop              = $8,
         additional_directions = $9,
         call_before_delivery  = $10,
         is_default            = $11,
         updated_at            = now()
       WHERE  id      = $1
         AND  user_id = $12
       RETURNING
         *,
         COALESCE(bus_stop, landmark, '') AS bus_stop`,
      [
        id,
        data.label                 ?? "Home",
        data.recipient_name,
        data.phone,
        data.state,
        data.city,
        data.address_line,
        busStop,
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
// ═════════════════════════════════════════════════════════════
router.delete("/:id", async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
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

    // Promote next address as default if we deleted the default
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
// ═════════════════════════════════════════════════════════════
router.patch("/:id/default", async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await findAddress(id, userId);
    if (!existing) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    await clearDefaults(userId, client);

    const { rows: [updated] } = await client.query(
      `UPDATE public.user_addresses
       SET    is_default = true,
              updated_at = now()
       WHERE  id = $1 AND user_id = $2
       RETURNING
         *,
         COALESCE(bus_stop, landmark, '') AS bus_stop`,
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