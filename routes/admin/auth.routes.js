import express from "express";
import { pool } from "../../server.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { verifyAdmin } from "./middleware.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

const generateToken = (admin) =>
  jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

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
      `SELECT DISTINCT p.name
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       JOIN admin_roles ar ON rp.role_id = ar.id
       WHERE ar.role_name = $1
       UNION
       SELECT p.name
       FROM admin_permissions ap
       JOIN permissions p ON ap.permission_id = p.id
       WHERE ap.admin_id = $2`,
      [admin.role, admin.id]
    );

    return res.json({ admin, permissions: perms.map((p) => p.name) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/stats", verifyAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      usersRes,
      activeUsersRes,
      bannedUsersRes,
      todayUsersRes,
      publicProductsRes,
      publicPendingRes,
      publicTodayRes,
      marketProductsRes,
      marketPendingRes,
      marketTodayRes,
      ordersRes,
      todayOrdersRes,
      revenueRes,
      todayRevenueRes,
      dailySalesRes,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM public.users`),
      pool.query(`SELECT COUNT(*) FROM public.users WHERE status != 'banned'`),
      pool.query(`SELECT COUNT(*) FROM public.users WHERE status = 'banned'`),
      pool.query(`SELECT COUNT(*) FROM public.users WHERE created_at >= $1`, [today]),
      pool.query(`SELECT COUNT(*) FROM public.products`).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) FROM public.products WHERE status = 'pending'`).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) FROM public.products WHERE created_at >= $1`, [today]).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) FROM market.products`).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) FROM market.products WHERE status = 'pending'`).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) FROM market.products WHERE created_at >= $1`, [today]).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) FROM orders`).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) FROM orders WHERE created_at >= $1`, [today]).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS revenue FROM payments WHERE status IN ('success','completed','paid')`),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS revenue FROM payments WHERE status IN ('success','completed','paid') AND created_at >= $1`, [today]),
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
      users:          Number(usersRes.rows[0].count),
      activeUsers:    Number(activeUsersRes.rows[0].count),
      bannedUsers:    Number(bannedUsersRes.rows[0].count),
      todayUsers:     Number(todayUsersRes.rows[0].count),
      totalProducts:   Number(publicProductsRes.rows[0].count),
      pendingProducts: Number(publicPendingRes.rows[0].count),
      todayProducts:   Number(publicTodayRes.rows[0].count),
      marketTotalProducts:   Number(marketProductsRes.rows[0].count),
      marketPendingProducts: Number(marketPendingRes.rows[0].count),
      marketTodayProducts:   Number(marketTodayRes.rows[0].count),
      orders:       Number(ordersRes.rows[0].count),
      todayOrders:  Number(todayOrdersRes.rows[0].count),
      revenue:      Number(revenueRes.rows[0].revenue),
      todayRevenue: Number(todayRevenueRes.rows[0].revenue),
      dailySales:   dailySalesRes.rows.map((r) => ({
        date: r.date,
        amount: Number(r.amount),
      })),
    });
  } catch (err) {
    console.error("[ADMIN] Stats error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;