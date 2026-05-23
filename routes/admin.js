import express from "express";
import { pool } from "../server.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { verifyAdmin, requireSuperAdmin } from "./admin/middleware.js";

import userRouter              from "./admin/user.js";
import { publicProductRouter } from "./admin/product.js";
import marketProductRouter     from "./admin/marketproducts.js";   // ← added
import paymentRouter           from "./admin/payment.js";
import orderRouter             from "./admin/order.js";
import reportRouter            from "./admin/report.js";
import systemRouter            from "./admin/system.js";
import { rolesRouter, permissionsRouter } from "./admin/roles.js";
import promotionRouter         from "./admin/promotion.js";

const router = express.Router();
const JWT_SECRET    = process.env.JWT_SECRET || "supersecret";
const generateToken = (admin) =>
  jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, JWT_SECRET, { expiresIn: "7d" });

/* ── Auth ── */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query(`SELECT * FROM admins WHERE email=$1`, [email]);
    const admin = rows[0];
    if (!admin) return res.status(404).json({ error: "Admin not found" });
    if (!await bcrypt.compare(password, admin.password_hash))
      return res.status(401).json({ error: "Invalid credentials" });
    res.json({ admin, token: generateToken(admin) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/me", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role FROM admins WHERE id=$1`, [req.admin.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Admin not found" });
    const admin = rows[0];

    const { rows: perms } = await pool.query(
      `SELECT DISTINCT p.name
       FROM role_permissions rp
       JOIN permissions   p  ON rp.permission_id = p.id
       JOIN admin_roles   ar ON rp.role_id       = ar.id
       WHERE ar.role_name = $1
       UNION
       SELECT p.name
       FROM admin_permissions ap
       JOIN permissions p ON ap.permission_id = p.id
       WHERE ap.admin_id = $2`,
      [admin.role, admin.id]
    );
    res.json({ admin, permissions: perms.map((p) => p.name) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── Stats ── */
router.get("/stats", verifyAdmin, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [
      usersRes, activeUsersRes, bannedUsersRes, todayUsersRes,
      pubProductsRes, pubPendingRes, pubTodayRes,
      mktProductsRes, mktPendingRes, mktTodayRes,
      ordersRes, todayOrdersRes,
      revenueRes, todayRevenueRes, dailySalesRes,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM public.users`),
      pool.query(`SELECT COUNT(*) FROM public.users WHERE status!='banned'`),
      pool.query(`SELECT COUNT(*) FROM public.users WHERE status='banned'`),
      pool.query(`SELECT COUNT(*) FROM public.users WHERE created_at>=$1`, [today]),
      pool.query(`SELECT COUNT(*) FROM public.products`).catch(()=>({rows:[{count:0}]})),
      pool.query(`SELECT COUNT(*) FROM public.products WHERE status='pending'`).catch(()=>({rows:[{count:0}]})),
      pool.query(`SELECT COUNT(*) FROM public.products WHERE created_at>=$1`,[today]).catch(()=>({rows:[{count:0}]})),
      pool.query(`SELECT COUNT(*) FROM market.products`).catch(()=>({rows:[{count:0}]})),
      pool.query(`SELECT COUNT(*) FROM market.products WHERE status='pending'`).catch(()=>({rows:[{count:0}]})),
      pool.query(`SELECT COUNT(*) FROM market.products WHERE created_at>=$1`,[today]).catch(()=>({rows:[{count:0}]})),
      pool.query(`SELECT COUNT(*) FROM orders`).catch(()=>({rows:[{count:0}]})),
      pool.query(`SELECT COUNT(*) FROM orders WHERE created_at>=$1`,[today]).catch(()=>({rows:[{count:0}]})),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS revenue FROM payments WHERE status IN ('success','completed','paid')`),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS revenue FROM payments WHERE status IN ('success','completed','paid') AND created_at>=$1`,[today]),
      pool.query(`SELECT DATE(created_at) AS date, COALESCE(SUM(amount),0) AS amount
                  FROM payments WHERE status IN ('success','completed','paid')
                    AND created_at>=NOW()-INTERVAL '30 days'
                  GROUP BY DATE(created_at) ORDER BY date ASC`),
    ]);

    res.json({
      users:       Number(usersRes.rows[0].count),
      activeUsers: Number(activeUsersRes.rows[0].count),
      bannedUsers: Number(bannedUsersRes.rows[0].count),
      todayUsers:  Number(todayUsersRes.rows[0].count),
      totalProducts:        Number(pubProductsRes.rows[0].count),
      pendingProducts:      Number(pubPendingRes.rows[0].count),
      todayProducts:        Number(pubTodayRes.rows[0].count),
      marketTotalProducts:  Number(mktProductsRes.rows[0].count),
      marketPendingProducts:Number(mktPendingRes.rows[0].count),
      marketTodayProducts:  Number(mktTodayRes.rows[0].count),
      orders:       Number(ordersRes.rows[0].count),
      todayOrders:  Number(todayOrdersRes.rows[0].count),
      revenue:      Number(revenueRes.rows[0].revenue),
      todayRevenue: Number(todayRevenueRes.rows[0].revenue),
      dailySales:   dailySalesRes.rows.map((r) => ({ date: r.date, amount: Number(r.amount) })),
    });
  } catch (err) {
    console.error("[ADMIN] Stats error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── Admin management ── */
router.get("/admins", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, status, created_at FROM admins ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/register", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "name, email, password required" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO admins (name, email, password_hash, role) VALUES ($1,$2,$3,$4)
       RETURNING id, name, email, role`,
      [name, email, hash, role || "moderator"]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/admins/:id/ban", verifyAdmin, requireSuperAdmin, async (req, res) => {
  try {
    await pool.query(
      `UPDATE admins SET status='banned', updated_at=NOW() WHERE id=$1`, [req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/assign-role", verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { admin_id, role } = req.body;
  try {
    await pool.query(`UPDATE admins SET role=$1 WHERE id=$2`, [role, admin_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── Logs ── */
router.get("/logs", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.id, l.action, l.details, l.created_at, a.name AS admin_name
       FROM admin_logs l LEFT JOIN admins a ON a.id = l.admin_id
       ORDER BY l.created_at DESC LIMIT 200`
    ).catch(() => pool.query(
      `SELECT id, action, details, created_at, NULL AS admin_name
       FROM audit_logs ORDER BY created_at DESC LIMIT 200`
    ));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── Mount sub-routers ── */
router.use("/users",           userRouter);
router.use("/products",        publicProductRouter);
router.use("/market-products", marketProductRouter);
router.use("/payments",        paymentRouter);
router.use("/orders",          orderRouter);
router.use("/reports",         reportRouter);
router.use("/system",          systemRouter);
router.use("/roles",           rolesRouter);
router.use("/permissions",     permissionsRouter);
router.use("/plans",           promotionRouter);

export default router;