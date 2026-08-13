/**
 * routes/checkout/address.js
 *
 * Buyer delivery-address management.
 *
 * v2 — Public zones + cross-device improvements
 * ─────────────────────────────────────────────────────────
 * ✓ /zones is PUBLIC (before auth guard)
 * ✓ Explicit auth guard for all other routes
 * ✓ last_used_at column supported for cross-device ranking
 * ✓ ORDER BY prefers most recently used address
 * ✓ POST /:id/mark-used endpoint for order flow
 * ✓ dual-write to bus_stop + landmark columns
 * ✓ Consistent COALESCE(bus_stop, landmark) on read
 * ✓ Phone normalisation via location.js
 *
 * Mounted at: /api/checkout/address (in server.js)
 *
 * ⚠️  RUN THIS MIGRATION BEFORE DEPLOY (if column doesn't exist):
 *
 *     ALTER TABLE public.user_addresses
 *     ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
 */

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

const MAX_ADDRESSES = 3;

/* ══════════════════════════════════════════════════════════════
   PUBLIC ROUTES  —  no auth required
   ─────────────────────────────────────────────────────────────
   Delivery zones are public information — the checkout page
   must be able to render state/city dropdowns before the user
   logs in.

   Any route defined BELOW the auth guard requires a valid
   JWT and populated req.user.
══════════════════════════════════════════════════════════════ */
router.get("/zones", (_req, res) => {
  return res.json({
    success: true,
    data:    DELIVERY_ZONES,
  });
});

/* ══════════════════════════════════════════════════════════════
   AUTH GUARD
   ─────────────────────────────────────────────────────────────
   Assumes an upstream JWT middleware has set req.user.
   If it hasn't, we reject with 401 rather than crash on
   req.user.id below.
══════════════════════════════════════════════════════════════ */
router.use((req, res, next) => {
  if (!req.user?.id) {
    return res.status(401).json({
      success: false,
      message: "Please log in to manage delivery addresses",
    });
  }
  next();
});

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
async function findAddress(id, userId, client = pool) {
  const { rows } = await client.query(
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

/*
 * Extract bus stop value from body — accepts either the new
 * "bus_stop" field name or the legacy "landmark" field name.
 */
function extractBusStop(body) {
  return (
    body.bus_stop?.trim()  ||
    body.landmark?.trim()  ||
    ""
  );
}

/*
 * Standard SELECT projection used across all list/read endpoints
 * so the response shape is identical regardless of endpoint.
 */
const ADDRESS_SELECT = `
  id,
  label,
  recipient_name,
  phone,
  state,
  city,
  address_line,
  landmark,
  COALESCE(bus_stop, landmark, '') AS bus_stop,
  additional_directions,
  call_before_delivery,
  is_default,
  last_used_at,
  created_at,
  updated_at
`;

/* ══════════════════════════════════════════════════════════════
   GET /  — list addresses
   ─────────────────────────────────────────────────────────────
   Order:
     1. Default address first
     2. Most recently used next (cross-device UX)
     3. Fallback to newest first
══════════════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${ADDRESS_SELECT}
       FROM   public.user_addresses
       WHERE  user_id = $1
       ORDER  BY is_default DESC,
                 last_used_at DESC NULLS LAST,
                 created_at DESC`,
      [req.user.id]
    );

    return res.json({ success: true, data: rows });

  } catch (err) {
    console.error("[GET /address]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch addresses",
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /:id
══════════════════════════════════════════════════════════════ */
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${ADDRESS_SELECT}
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

    return res.json({ success: true, data: rows[0] });

  } catch (err) {
    console.error("[GET /address/:id]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch address",
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /  — create address
══════════════════════════════════════════════════════════════ */
router.post("/", async (req, res) => {
  const data    = normalizeAddress(req.body);
  const busStop = extractBusStop(req.body);

  if (!busStop) {
    return res.status(422).json({
      success: false,
      message: "Please fix the errors below",
      errors:  { bus_stop: "Nearest bus stop is required" },
    });
  }

  /* Full validation — writes bus_stop into address for the validator */
  data.bus_stop = busStop;
  data.landmark = busStop;

  const validation = validateAddress(data);
  if (!validation.valid) {
    return res.status(422).json({
      success: false,
      message: "Please fix the errors below",
      errors:  validation.errors,
    });
  }

  /* ── Max address check ── */
  const { rows: [{ count }] } = await pool.query(
    `SELECT COUNT(*) FROM public.user_addresses WHERE user_id = $1`,
    [req.user.id]
  );

  if (Number(count) >= MAX_ADDRESSES) {
    return res.status(400).json({
      success: false,
      message:
        `Maximum ${MAX_ADDRESSES} addresses allowed. ` +
        `Delete one to add a new address.`,
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
         (user_id, label, recipient_name, phone, state, city,
          address_line, landmark, bus_stop,
          additional_directions, call_before_delivery, is_default,
          created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11, now(), now())
       RETURNING ${ADDRESS_SELECT}`,
      [
        req.user.id,
        data.label,
        data.recipient_name,
        data.phone,
        data.state,
        data.city,
        data.address_line,
        busStop,                       /* $8 → both landmark AND bus_stop */
        data.additional_directions,
        data.call_before_delivery,
        data.is_default,
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

/* ══════════════════════════════════════════════════════════════
   PATCH /:id  — partial update
   ─────────────────────────────────────────────────────────────
   Only fields present in the request body are updated.
   COALESCE-with-null pattern preserves existing values.
══════════════════════════════════════════════════════════════ */
router.patch("/:id", async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const data   = normalizeAddress(req.body);
  const errors = {};

  /* ── Field-level validation for provided fields only ── */
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

  const hasBusStop =
    req.body.bus_stop !== undefined ||
    req.body.landmark !== undefined;

  const busStop = hasBusStop ? extractBusStop(req.body) : null;

  if (hasBusStop) {
    if (!busStop) {
      errors.bus_stop = "Bus stop is required";
    } else if (busStop.length < 5) {
      errors.bus_stop = "Enter a real bus stop (e.g. Oja Oba bus stop)";
    }
  }

  if (req.body.phone !== undefined && data.phone) {
    if (!/^0[7-9][01]\d{8}$/.test(data.phone)) {
      errors.phone = "Enter a valid Nigerian phone number";
    }
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

    const existing = await findAddress(id, userId, client);
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
       RETURNING ${ADDRESS_SELECT}`,
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
        req.body.call_before_delivery  !== undefined ? data.call_before_delivery  : null,
        req.body.is_default            !== undefined ? data.is_default            : null,
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

/* ══════════════════════════════════════════════════════════════
   PUT /:id  — full replacement
   ─────────────────────────────────────────────────────────────
   Kept for frontend compatibility. All fields required.
══════════════════════════════════════════════════════════════ */
router.put("/:id", async (req, res) => {
  const userId  = req.user.id;
  const { id } = req.params;
  const data    = normalizeAddress(req.body);
  const busStop = extractBusStop(req.body);

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

  data.bus_stop = busStop;
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

    const existing = await findAddress(id, userId, client);
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
       RETURNING ${ADDRESS_SELECT}`,
      [
        id,
        data.label,
        data.recipient_name,
        data.phone,
        data.state,
        data.city,
        data.address_line,
        busStop,
        data.additional_directions,
        data.call_before_delivery,
        data.is_default,
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

/* ══════════════════════════════════════════════════════════════
   DELETE /:id
   ─────────────────────────────────────────────────────────────
   If the deleted address was the default, automatically
   promote the most-recently-used remaining address to default
   so the user isn't left without one.
══════════════════════════════════════════════════════════════ */
router.delete("/:id", async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await findAddress(id, userId, client);
    if (!existing) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    await client.query(
      `DELETE FROM public.user_addresses
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    /* Promote next address if we removed the default */
    if (existing.is_default) {
      await client.query(
        `UPDATE public.user_addresses
         SET    is_default = true,
                updated_at = now()
         WHERE  user_id = $1
           AND  id = (
             SELECT id FROM public.user_addresses
             WHERE  user_id = $1
             ORDER  BY last_used_at DESC NULLS LAST,
                       created_at DESC
             LIMIT  1
           )`,
        [userId]
      );
    }

    await client.query("COMMIT");

    return res.json({ success: true, message: "Address deleted" });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[DELETE /address/:id]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to delete address",
    });
  } finally {
    client.release();
  }
});

/* ══════════════════════════════════════════════════════════════
   PATCH /:id/default  — set as default address
══════════════════════════════════════════════════════════════ */
router.patch("/:id/default", async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await findAddress(id, userId, client);
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
       RETURNING ${ADDRESS_SELECT}`,
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

/* ══════════════════════════════════════════════════════════════
   PATCH /:id/mark-used  — cross-device ranking
   ─────────────────────────────────────────────────────────────
   Called by the checkout flow whenever an order is placed
   using this address. Bumps last_used_at so on subsequent
   sessions (potentially on a different device) this address
   surfaces first.

   Idempotent — safe to call multiple times.
══════════════════════════════════════════════════════════════ */
router.patch("/:id/mark-used", async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const { rows: [updated] } = await pool.query(
      `UPDATE public.user_addresses
       SET    last_used_at = now(),
              updated_at   = now()
       WHERE  id = $1 AND user_id = $2
       RETURNING id, last_used_at`,
      [id, userId]
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    return res.json({ success: true, data: updated });

  } catch (err) {
    console.error("[PATCH /address/:id/mark-used]", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to mark address as used",
    });
  }
});

export default router;