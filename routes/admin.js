import express from "express";
import { pool } from "../server.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const generateToken = (admin) =>
  jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

const cleanBigInt = (v) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? s : null;
};

const safeInt = (v, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

/* ─────────────────────────────────────────────
   MIDDLEWARE
───────────────────────────────────────────── */
export const verifyAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

const requireSuperAdmin = (req, res, next) => {
  if (req.admin?.role !== "super_admin")
    return res.status(403).json({ error: "Forbidden — super_admin only" });
  next();
};

/* ─────────────────────────────────────────────
   AUTH
───────────────────────────────────────────── */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM admins WHERE email = $1`,
      [email]
    );
    const admin = rows[0];
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    return res.json({ admin, token: generateToken(admin) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/me", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role FROM admins WHERE id = $1`,
      [req.admin.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Admin not found" });
    const admin = rows[0];

    const { rows: perms } = await pool.query(
      `
      SELECT DISTINCT p.name
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      JOIN admin_roles ar ON rp.role_id = ar.id
      WHERE ar.role_name = $1
      UNION
      SELECT p.name
      FROM admin_permissions ap
      JOIN permissions p ON ap.permission_id = p.id
      WHERE ap.admin_id = $2
    `,
      [admin.role, admin.id]
    );

    return res.json({ admin, permissions: perms.map((p) => p.name) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   STATS
───────────────────────────────────────────── */
router.get("/stats", verifyAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      usersRes,
      activeUsersRes,
      bannedUsersRes,
      todayUsersRes,
      productsRes,
      pendingRes,
      todayProductsRes,
      ordersRes,
      todayOrdersRes,
      revenueRes,
      todayRevenueRes,
      dailySalesRes,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM users`),
      pool.query(`SELECT COUNT(*) FROM users WHERE status != 'banned'`),
      pool.query(`SELECT COUNT(*) FROM users WHERE status = 'banned'`),
      pool.query(`SELECT COUNT(*) FROM users WHERE created_at >= $1`, [today]),
      pool.query(`SELECT COUNT(*) FROM products`),
      pool.query(`SELECT COUNT(*) FROM products WHERE status = 'pending'`),
      pool.query(`SELECT COUNT(*) FROM products WHERE created_at >= $1`, [today]),
      pool
        .query(`SELECT COUNT(*) FROM orders`)
        .catch(() => ({ rows: [{ count: 0 }] })),
      pool
        .query(`SELECT COUNT(*) FROM orders WHERE created_at >= $1`, [today])
        .catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`
        SELECT COALESCE(SUM(amount),0) AS revenue FROM payments
        WHERE status IN ('success','completed','paid')
      `),
      pool.query(
        `
        SELECT COALESCE(SUM(amount),0) AS revenue FROM payments
        WHERE status IN ('success','completed','paid') AND created_at >= $1
      `,
        [today]
      ),
      pool.query(`
        SELECT DATE(created_at) AS date, COALESCE(SUM(amount), 0) AS amount
        FROM payments
        WHERE status IN ('success','completed','paid')
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `),
    ]);

    return res.json({
      users: Number(usersRes.rows[0].count),
      activeUsers: Number(activeUsersRes.rows[0].count),
      bannedUsers: Number(bannedUsersRes.rows[0].count),
      todayUsers: Number(todayUsersRes.rows[0].count),
      totalProducts: Number(productsRes.rows[0].count),
      pendingProducts: Number(pendingRes.rows[0].count),
      todayProducts: Number(todayProductsRes.rows[0].count),
      orders: Number(ordersRes.rows[0].count),
      todayOrders: Number(todayOrdersRes.rows[0].count),
      revenue: Number(revenueRes.rows[0].revenue),
      todayRevenue: Number(todayRevenueRes.rows[0].revenue),
      dailySales: dailySalesRes.rows.map((r) => ({
        date: r.date,
        amount: Number(r.amount),
      })),
    });
  } catch (err) {
    console.error("[ADMIN] Stats error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   USERS
───────────────────────────────────────────── */
router.get("/users", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, email, phone_number, city, state,
             status, balance, created_at, last_login,
             store_name, profile_picture
      FROM users
      ORDER BY created_at DESC
      LIMIT 500
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/users/:id/ban", verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE users SET status = 'banned', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    await pool
      .query(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'ban_user', 'user', $2, $3)`,
        [req.admin.id, req.params.id, `Banned user ${req.params.id}`]
      )
      .catch(() => {});
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/users/:id/unban", verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   ADMINS
───────────────────────────────────────────── */
router.get("/admins", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, status, created_at
       FROM admins ORDER BY created_at DESC`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/register", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "name, email, password required" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO admins (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, email, hash, role || "moderator"]
    );
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post(
  "/admins/:id/ban",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      await pool.query(
        `UPDATE admins SET status = 'banned', updated_at = NOW() WHERE id = $1`,
        [req.params.id]
      );
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

router.post(
  "/assign-role",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    const { admin_id, role } = req.body;
    try {
      await pool.query(`UPDATE admins SET role = $1 WHERE id = $2`, [
        role,
        admin_id,
      ]);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

/* ─────────────────────────────────────────────
   PRODUCTS — list / pending / approve / reject
───────────────────────────────────────────── */
router.get("/products", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.title AS name, p.price, p.status,
             p.is_active, p.is_promoted, p.thumbnail_url,
             p.location_city, p.location_state, p.created_at,
             u.name AS seller_name, c.name AS category_name
      FROM products p
      LEFT JOIN users      u ON u.id = p.seller_id
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.created_at DESC
      LIMIT 500
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/products/pending", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.title AS name, p.price, p.status,
             p.is_active, p.is_promoted, p.thumbnail_url,
             p.location_city, p.location_state, p.created_at,
             u.name AS seller_name, c.name AS category_name
      FROM products p
      LEFT JOIN users      u ON u.id = p.seller_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'pending'
      ORDER BY p.created_at ASC
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/products/:id/approve", verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE products
       SET status = 'active', is_active = true, updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );
    await pool
      .query(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'approve_product', 'product', $2, $3)`,
        [
          req.admin.id,
          req.params.id,
          `Approved product ${req.params.id}`,
        ]
      )
      .catch(() => {});
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/products/:id/reject", verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE products
       SET status = 'rejected', is_active = false, updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );
    await pool
      .query(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
       VALUES ($1, 'reject_product', 'product', $2, $3)`,
        [
          req.admin.id,
          req.params.id,
          `Rejected product ${req.params.id}`,
        ]
      )
      .catch(() => {});
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   PRODUCTS — extended moderation & editing
───────────────────────────────────────────── */

/**
 * PATCH /admin/products/:id
 * Admin can edit title, description, status, flags, notes.
 * Only fields present in body are updated.
 */
router.patch("/products/:id", verifyAdmin, async (req, res) => {
  const productId = req.params.id;

  try {
    /* Verify product exists */
    const { rows } = await pool.query(
      `SELECT id, title AS name, status, seller_id
       FROM products WHERE id = $1`,
      [productId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    const product = rows[0];

    /*
     * Allowed fields — map admin-facing keys to actual DB column names.
     * "name" in the old code mapped to the column "title" in products,
     * so we keep "title" here; adjust to match your real schema.
     */
    const allowed = [
      "title",           // was "name" — use whichever your column is called
      "description",
      "category_id",     // use the FK column, not "category"
      "price",           // adjust to base_price / original_price as needed
      "status",
      "is_active",
      "is_flagged",
      "is_featured",
      "is_trending",
      "is_sponsored",
      "is_hidden",
      "is_paused",
      "rejection_reason",
      "admin_notes",
    ];

    const VALID_STATUSES = new Set([
      "pending_review",
      "active",
      "rejected",
      "flagged",
      "paused",
      "sold",
      "deleted",
    ]);

    /* Build SET clause dynamically from body */
    const sets = [];
    const params = [];
    let idx = 1;

    for (const key of allowed) {
      if (req.body[key] === undefined) continue;

      const val = req.body[key];

      /* Validate status */
      if (key === "status" && !VALID_STATUSES.has(val)) {
        return res.status(400).json({
          error: `Invalid status. Allowed: ${[...VALID_STATUSES].join(", ")}`,
        });
      }

      /* Side-effects when status changes */
      if (key === "status") {
        if (val === "active") {
          sets.push(`is_active = true`);
          sets.push(`is_paused = false`);
          sets.push(`rejection_reason = NULL`);
        }
        if (val === "rejected") {
          sets.push(`is_active = false`);
        }
        if (val === "paused") {
          sets.push(`is_active = false`);
          sets.push(`is_paused = true`);
        }
        if (val === "sold") {
          sets.push(`is_active = false`);
          sets.push(`sold_at = NOW()`);
        }
      }

      params.push(val);
      sets.push(`${key} = $${idx++}`);
    }

    if (!sets.length) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    /* Always stamp who reviewed and when */
    sets.push(`updated_at = NOW()`);
    sets.push(`reviewed_by = $${idx++}`);
    sets.push(`reviewed_at = NOW()`);
    params.push(req.admin.id); // reviewed_by
    params.push(productId);    // WHERE id = $idx

    await pool.query(
      `UPDATE products
       SET ${sets.join(", ")}
       WHERE id = $${idx}`,
      params
    );

    /* Audit log */
    const changedFields = Object.keys(req.body)
      .filter((k) => allowed.includes(k))
      .map((k) => `${k}: ${JSON.stringify(req.body[k])}`)
      .join(", ");

    await pool
      .query(
        `INSERT INTO admin_logs
           (admin_id, action, target_type, target_id, details, metadata)
         VALUES ($1, 'edit_product', 'product', $2, $3, $4)`,
        [
          req.admin.id,
          productId,
          `Edited product "${product.name}" — ${changedFields}`,
          JSON.stringify(req.body),
        ]
      )
      .catch(() => {});

    return res.json({ success: true, message: "Product updated" });
  } catch (err) {
    console.error("[ADMIN PATCH /products/:id]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /admin/products/:id/flag
 * Toggle a boolean flag on a product.
 * Body: { flag: "is_featured", value: true }
 */
router.post("/products/:id/flag", verifyAdmin, async (req, res) => {
  const { flag, value } = req.body;
  const productId = req.params.id;

  const ALLOWED_FLAGS = [
    "is_featured",
    "is_trending",
    "is_sponsored",
    "is_hidden",
  ];

  if (!ALLOWED_FLAGS.includes(flag)) {
    return res.status(400).json({
      error: `Invalid flag. Allowed: ${ALLOWED_FLAGS.join(", ")}`,
    });
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE products
       SET ${flag} = $1, updated_at = NOW()
       WHERE id = $2`,
      [!!value, productId]
    );

    if (!rowCount)
      return res.status(404).json({ error: "Product not found" });

    await pool
      .query(
        `INSERT INTO admin_logs
           (admin_id, action, target_type, target_id, details)
         VALUES ($1, $2, 'product', $3, $4)`,
        [
          req.admin.id,
          value ? `set_${flag}` : `unset_${flag}`,
          productId,
          `${flag} set to ${value}`,
        ]
      )
      .catch(() => {});

    return res.json({ success: true, [flag]: !!value });
  } catch (err) {
    console.error("[ADMIN flag]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /admin/products/:id/pause
 * Toggles the pause state of a listing.
 */
router.post("/products/:id/pause", verifyAdmin, async (req, res) => {
  const productId = req.params.id;

  try {
    const { rows } = await pool.query(
      `SELECT id, title AS name, is_paused, status
       FROM products WHERE id = $1`,
      [productId]
    );
    if (!rows.length)
      return res.status(404).json({ error: "Product not found" });

    const product = rows[0];
    const nowPaused = !product.is_paused;
    const nextStatus = nowPaused ? "paused" : "active";

    await pool.query(
      `UPDATE products
       SET is_paused  = $1,
           is_active  = $2,
           status     = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [nowPaused, !nowPaused, nextStatus, productId]
    );

    await pool
      .query(
        `INSERT INTO admin_logs
           (admin_id, action, target_type, target_id, details)
         VALUES ($1, $2, 'product', $3, $4)`,
        [
          req.admin.id,
          nowPaused ? "pause_product" : "unpause_product",
          productId,
          `${nowPaused ? "Paused" : "Unpaused"} product "${product.name}"`,
        ]
      )
      .catch(() => {});

    return res.json({
      success: true,
      is_paused: nowPaused,
      status: nextStatus,
      message: nowPaused ? "Listing paused" : "Listing resumed",
    });
  } catch (err) {
    console.error("[ADMIN pause]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /admin/products/:id/remove
 * Soft-delete a product with a mandatory reason.
 * Body: { reason: string }
 */
router.post("/products/:id/remove", verifyAdmin, async (req, res) => {
  const { reason } = req.body;

  if (!reason?.trim()) {
    return res.status(400).json({ error: "A removal reason is required" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, title AS name, seller_id
       FROM products
       WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ error: "Product not found" });

    const product = rows[0];

    await pool.query(
      `UPDATE products
       SET status         = 'deleted',
           is_active      = false,
           is_paused      = false,
           deleted_at     = NOW(),
           removed_reason = $1,
           reviewed_by    = $2,
           reviewed_at    = NOW(),
           updated_at     = NOW()
       WHERE id = $3`,
      [reason.trim(), req.admin.id, req.params.id]
    );

    await pool
      .query(
        `INSERT INTO admin_logs
           (admin_id, action, target_type, target_id, details)
         VALUES ($1, 'remove_product', 'product', $2, $3)`,
        [
          req.admin.id,
          req.params.id,
          `Removed "${product.name}" — reason: ${reason.trim()}`,
        ]
      )
      .catch(() => {});

    return res.json({ success: true, message: "Product removed" });
  } catch (err) {
    console.error("[ADMIN remove]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /admin/products/:id/permanent
 * Hard-delete — super_admin only.
 * Removes Cloudinary images first, then CASCADE-deletes the DB row.
 */
router.delete(
  "/products/:id/permanent",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, title AS name FROM products WHERE id = $1`,
        [req.params.id]
      );
      if (!rows.length)
        return res.status(404).json({ error: "Product not found" });

      /* Remove Cloudinary assets before the DB row disappears */
      const { rows: imgs } = await pool.query(
        `SELECT public_id FROM product_images WHERE product_id = $1`,
        [req.params.id]
      );

      if (imgs.length) {
        const cloudinary = (await import("cloudinary")).v2;
        await Promise.all(
          imgs
            .filter((i) => i.public_id)
            .map((i) =>
              cloudinary.uploader.destroy(i.public_id).catch(() => {})
            )
        );
      }

      /* CASCADE handles child tables */
      await pool.query(`DELETE FROM products WHERE id = $1`, [req.params.id]);

      await pool
        .query(
          `INSERT INTO admin_logs
             (admin_id, action, target_type, target_id, details)
           VALUES ($1, 'permanent_delete', 'product', $2, $3)`,
          [
            req.admin.id,
            req.params.id,
            `Permanently deleted "${rows[0].name}"`,
          ]
        )
        .catch(() => {});

      return res.json({
        success: true,
        message: "Product permanently deleted",
      });
    } catch (err) {
      console.error("[ADMIN permanent delete]", err.message);
      return res.status(500).json({ error: err.message });
    }
  }
);

/* ─────────────────────────────────────────────
   PAYMENTS
───────────────────────────────────────────── */
router.get("/payments", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.amount, p.status, p.type, p.method,
             p.reference, p.created_at, p.updated_at,
             u.name AS user, u.email AS user_email
      FROM payments p
      LEFT JOIN users u ON u.id = p.seller_id
      ORDER BY p.created_at DESC
      LIMIT 500
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post(
  "/payments/:id/refund",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      await pool.query(
        `UPDATE payments SET status = 'refunded', updated_at = NOW() WHERE id = $1`,
        [req.params.id]
      );
      await pool
        .query(
          `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
         VALUES ($1, 'refund_payment', 'payment', $2, $3)`,
          [
            req.admin.id,
            req.params.id,
            `Refunded payment ${req.params.id}`,
          ]
        )
        .catch(() => {});
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

/* ─────────────────────────────────────────────
   ORDERS
───────────────────────────────────────────── */
router.get("/orders", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool
      .query(
        `SELECT o.id, o.status, o.total, o.created_at,
             u.name AS buyer_name, u.email AS buyer_email,
             COUNT(oi.id) AS item_count
      FROM orders o
      LEFT JOIN users       u  ON u.id        = o.buyer_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id, u.name, u.email
      ORDER BY o.created_at DESC
      LIMIT 300`
      )
      .catch(() => ({ rows: [] }));
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/orders/:id/cancel", verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   ACTIVITY LOGS
───────────────────────────────────────────── */
router.get("/logs", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool
      .query(
        `SELECT l.id, l.action, l.details, l.created_at, a.name AS admin_name
      FROM admin_logs l
      LEFT JOIN admins a ON a.id = l.admin_id
      ORDER BY l.created_at DESC
      LIMIT 200`
      )
      .catch(() =>
        pool.query(`
        SELECT id, action, details, created_at, NULL AS admin_name
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 200
      `)
      );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   SYSTEM CONFIG
───────────────────────────────────────────── */
router.get("/system", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool
      .query(`SELECT key, value FROM system_config`)
      .catch(() => ({ rows: [] }));

    const config = {
      maintenance: false,
      allowPosting: true,
      allowPayments: true,
    };
    rows.forEach(({ key, value }) => {
      if (key === "maintenance") config.maintenance = value === "true";
      if (key === "allowPosting") config.allowPosting = value !== "false";
      if (key === "allowPayments") config.allowPayments = value !== "false";
    });

    return res.json(config);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post(
  "/system",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    const { maintenance, allowPosting, allowPayments } = req.body;
    try {
      const upsert = (key, value) =>
        pool.query(
          `INSERT INTO system_config (key, value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE
             SET value = EXCLUDED.value, updated_at = NOW()`,
          [key, String(value)]
        );

      await Promise.all([
        upsert("maintenance", maintenance ?? false),
        upsert("allowPosting", allowPosting ?? true),
        upsert("allowPayments", allowPayments ?? true),
      ]);

      await pool
        .query(
          `INSERT INTO admin_logs (admin_id, action, details)
           VALUES ($1, 'system_config_update', $2)`,
          [
            req.admin.id,
            JSON.stringify({ maintenance, allowPosting, allowPayments }),
          ]
        )
        .catch(() => {});

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

/* ─────────────────────────────────────────────
   PROMOTION PLANS
───────────────────────────────────────────── */
router.get("/plans", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id::text, name, price, discount_percent,
             duration, duration_days, priority, sort_order,
             features, is_active,
             (price * (1 - discount_percent / 100.0)) AS effective_price,
             created_at, updated_at
      FROM promotion_plans
      ORDER BY sort_order ASC, price ASC
    `);

    const plans = rows.map((p) => ({
      ...p,
      features: (() => {
        if (Array.isArray(p.features)) return p.features;
        if (typeof p.features === "string") {
          try {
            return JSON.parse(p.features);
          } catch {
            return [];
          }
        }
        return [];
      })(),
    }));

    return res.json({ success: true, plans });
  } catch (err) {
    console.error("[ADMIN] Plans error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.put(
  "/plans/:id",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    const planId = cleanBigInt(req.params.id);
    if (!planId) return res.status(400).json({ error: "Invalid plan ID" });

    const {
      name,
      price,
      discount_percent,
      duration_days,
      duration,
      priority,
      sort_order,
      is_active,
      features,
    } = req.body;

    try {
      const safeFeatures = Array.isArray(features) ? features : [];
      await pool.query(
        `UPDATE promotion_plans
         SET name             = $1,
             price            = $2,
             discount_percent = $3,
             duration_days    = $4,
             duration         = $5,
             priority         = $6,
             sort_order       = $7,
             is_active        = $8,
             features         = $9::JSONB,
             updated_at       = NOW()
         WHERE id = $10`,
        [
          name,
          Number(price),
          Number(discount_percent ?? 0),
          Number(duration_days ?? 30),
          duration ?? "",
          Number(priority ?? 0),
          Number(sort_order ?? 0),
          !!is_active,
          JSON.stringify(safeFeatures),
          planId,
        ]
      );

      await pool
        .query(
          `INSERT INTO admin_logs
             (admin_id, action, target_type, target_id, details)
           VALUES ($1, 'update_plan', 'promotion_plan', $2, $3)`,
          [
            req.admin.id,
            planId,
            `Updated plan "${name}" — price: ${price}, discount: ${discount_percent}%`,
          ]
        )
        .catch(() => {});

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

router.post(
  "/plans/:id/toggle",
  verifyAdmin,
  requireSuperAdmin,
  async (req, res) => {
    const planId = cleanBigInt(req.params.id);
    if (!planId) return res.status(400).json({ error: "Invalid plan ID" });

    try {
      const { rows } = await pool.query(
        `UPDATE promotion_plans
         SET is_active = NOT is_active, updated_at = NOW()
         WHERE id = $1
         RETURNING id::text, name, is_active`,
        [planId]
      );
      if (!rows.length)
        return res.status(404).json({ error: "Plan not found" });

      return res.json({ success: true, plan: rows[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

/* ─────────────────────────────────────────────
   REPORTS
   /reports/stats MUST come before /reports/:reportId
───────────────────────────────────────────── */

router.get("/reports/stats", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)                                                          ::INT AS total,
        COUNT(*) FILTER (WHERE status = 'pending')                       ::INT AS pending,
        COUNT(*) FILTER (WHERE status = 'reviewing')                     ::INT AS reviewing,
        COUNT(*) FILTER (WHERE status = 'resolved')                      ::INT AS resolved,
        COUNT(*) FILTER (WHERE status = 'dismissed')                     ::INT AS dismissed,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') ::INT AS last_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')   ::INT AS last_7d
      FROM public.chat_reports
    `);
    return res.json(rows[0]);
  } catch (err) {
    console.error("[ADMIN] report stats error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/reports", verifyAdmin, async (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  const pageSize   = Math.min(safeInt(limit, 50), 500);
  const pageOffset = safeInt(offset, 0);

  try {
    const params = [];
    let whereClause = "";

    if (status && status !== "all") {
      params.push(status);
      whereClause = `WHERE cr.status = $${params.length}`;
    }

    params.push(pageSize);
    params.push(pageOffset);

    const { rows } = await pool.query(
      `SELECT
         cr.id,
         cr.reason,
         cr.details,
         cr.status,
         cr.created_at,
         cr.updated_at,
         cr.conversation_id,
         cr.message_id,

         rep.id            AS reporter_id,
         rep.name          AS reporter_name,
         rep.email         AS reporter_email,
         rep.profile_image AS reporter_image,

         rep2.id            AS reported_id,
         rep2.name          AS reported_name,
         rep2.email         AS reported_email,
         rep2.profile_image AS reported_image,

         ct.last_message,
         ct.last_message_at,
         ct.is_under_review,
         ct.buyer_id,
         ct.seller_id,

         cm.message      AS flagged_message,
         cm.message_type AS flagged_message_type,
         cm.created_at   AS flagged_at

       FROM public.chat_reports       cr
       JOIN public.users              rep  ON rep.id  = cr.reporter_id
       JOIN public.chat_threads       ct   ON ct.id   = cr.conversation_id
       JOIN public.users              rep2 ON rep2.id = CASE
         WHEN ct.buyer_id = cr.reporter_id THEN ct.seller_id
         ELSE ct.buyer_id
       END
       LEFT JOIN public.chat_messages cm   ON cm.id   = cr.message_id
       ${whereClause}
       ORDER BY cr.created_at DESC
       LIMIT  $${params.length - 1}
       OFFSET $${params.length}`,
      params
    );

    const countParams = status && status !== "all" ? [status] : [];
    const countWhere  = status && status !== "all" ? "WHERE status = $1" : "";
    const { rows: cr } = await pool.query(
      `SELECT COUNT(*)::INT AS total FROM public.chat_reports ${countWhere}`,
      countParams
    );

    return res.json({ reports: rows, total: cr[0].total });
  } catch (err) {
    console.error("[ADMIN] GET /reports error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/reports/:reportId", verifyAdmin, async (req, res) => {
  const { reportId } = req.params;
  try {
    const { rows: rr } = await pool.query(
      `SELECT
         cr.*,
         rep.name          AS reporter_name,
         rep.email         AS reporter_email,
         rep.profile_image AS reporter_image,
         rep2.name          AS reported_name,
         rep2.email         AS reported_email,
         rep2.profile_image AS reported_image,
         ct.is_under_review,
         ct.buyer_id,
         ct.seller_id,
         ct.last_message,
         ct.last_message_at,
         cm.message      AS flagged_message,
         cm.message_type AS flagged_message_type,
         cm.created_at   AS flagged_at
       FROM public.chat_reports       cr
       JOIN public.users              rep  ON rep.id  = cr.reporter_id
       JOIN public.chat_threads       ct   ON ct.id   = cr.conversation_id
       JOIN public.users              rep2 ON rep2.id = CASE
         WHEN ct.buyer_id = cr.reporter_id THEN ct.seller_id
         ELSE ct.buyer_id
       END
       LEFT JOIN public.chat_messages cm ON cm.id = cr.message_id
       WHERE cr.id = $1`,
      [reportId]
    );

    if (!rr[0]) return res.status(404).json({ error: "Report not found" });

    const { rows: messages } = await pool.query(
      `SELECT m.*, u.name AS sender_name, u.profile_image AS sender_image
       FROM public.chat_messages m
       JOIN public.users         u ON u.id = m.sender_id
       WHERE m.thread_id = $1
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [rr[0].conversation_id]
    );

    return res.json({ report: rr[0], messages: messages.reverse() });
  } catch (err) {
    console.error("[ADMIN] GET /reports/:id error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.patch("/reports/:reportId", verifyAdmin, async (req, res) => {
  const { reportId } = req.params;
  const { status } = req.body;

  const VALID = new Set(["pending", "reviewing", "resolved", "dismissed"]);
  if (!VALID.has(status))
    return res
      .status(400)
      .json({ error: "status must be pending|reviewing|resolved|dismissed" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows, rowCount } = await client.query(
      `UPDATE public.chat_reports
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING conversation_id, status`,
      [status, reportId]
    );

    if (!rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Report not found" });
    }

    const convId = rows[0].conversation_id;

    if (status === "resolved" || status === "dismissed") {
      const { rows: others } = await client.query(
        `SELECT id FROM public.chat_reports
         WHERE conversation_id = $1
           AND id     <> $2
           AND status IN ('pending', 'reviewing')`,
        [convId, reportId]
      );
      if (others.length === 0) {
        await client.query(
          `UPDATE public.chat_threads SET is_under_review = false WHERE id = $1`,
          [convId]
        );
      }
    }

    if (status === "reviewing") {
      await client.query(
        `UPDATE public.chat_threads SET is_under_review = true WHERE id = $1`,
        [convId]
      );
    }

    await client
      .query(
        `INSERT INTO admin_logs
           (admin_id, action, target_type, target_id, details)
         VALUES ($1, 'update_report_status', 'chat_report', $2, $3)`,
        [req.admin.id, reportId, `Status changed to ${status}`]
      )
      .catch(() => {});

    await client.query("COMMIT");
    return res.json({ success: true, status: rows[0].status });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[ADMIN] PATCH /reports/:id error:", err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post(
  "/reports/:reportId/ban-seller",
  verifyAdmin,
  async (req, res) => {
    const { reportId } = req.params;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: rr } = await client.query(
        `SELECT cr.conversation_id, ct.seller_id, ct.buyer_id, cr.reporter_id
         FROM public.chat_reports cr
         JOIN public.chat_threads ct ON ct.id = cr.conversation_id
         WHERE cr.id = $1`,
        [reportId]
      );

      if (!rr[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Report not found" });
      }

      const reportedId =
        rr[0].reporter_id === rr[0].buyer_id
          ? rr[0].seller_id
          : rr[0].buyer_id;

      await client.query(
        `UPDATE public.users
         SET status = 'banned', updated_at = NOW()
         WHERE id = $1`,
        [reportedId]
      );

      await client.query(
        `UPDATE public.chat_reports
         SET status = 'resolved', updated_at = NOW()
         WHERE id = $1`,
        [reportId]
      );

      await client.query(
        `UPDATE public.chat_threads
         SET is_under_review = false
         WHERE id = $1`,
        [rr[0].conversation_id]
      );

      await client
        .query(
          `INSERT INTO admin_logs
             (admin_id, action, target_type, target_id, details)
           VALUES
             ($1, 'ban_user',           'user',        $2, $3),
             ($1, 'resolve_report_ban', 'chat_report', $4, $5)`,
          [
            req.admin.id,
            reportedId,
            `Banned via report ${reportId}`,
            reportId,
            `Report resolved — user ${reportedId} banned`,
          ]
        )
        .catch(() => {});

      await client.query("COMMIT");
      return res.json({ success: true, banned: reportedId });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[ADMIN] ban-seller error:", err.message);
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }
);

/* ─────────────────────────────────────────────
   ROLES & PERMISSIONS
───────────────────────────────────────────── */
router.post("/roles", verifyAdmin, async (req, res) => {
  const { role_name, description } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_roles (role_name, description) VALUES ($1, $2) RETURNING *`,
      [role_name, description]
    );
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/roles", verifyAdmin, async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM admin_roles`);
  return res.json(rows);
});

router.post("/permissions", verifyAdmin, async (req, res) => {
  const { name, description } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO permissions (name, description) VALUES ($1, $2) RETURNING *`,
      [name, description]
    );
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/permissions", verifyAdmin, async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM permissions`);
  return res.json(rows);
});

router.post("/roles/assign-permission", verifyAdmin, async (req, res) => {
  const { role_id, permission_id } = req.body;
  try {
    await pool.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [role_id, permission_id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/roles/:id/permissions", verifyAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.name
     FROM role_permissions rp
     JOIN permissions p ON rp.permission_id = p.id
     WHERE rp.role_id = $1`,
    [req.params.id]
  );
  return res.json(rows);
});

export default router;