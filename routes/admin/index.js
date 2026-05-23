import express from "express";
import { verifyAdmin } from "./auth.routes.js";

const router = express.Router();

/* ── Import route modules ── */
import authRoutes     from "./auth.routes.js";
import userRoutes     from "./users.routes.js";
import marketRoutes   from "./marketproducts.js";
import legacyRoutes   from "./products.routes.js";
import paymentRoutes  from "./payments.routes.js";
import orderRoutes    from "./orders.routes.js";
import reportRoutes   from "./reports.routes.js";
import systemRoutes   from "./system.routes.js";
import roleRoutes     from "./roles.routes.js";

/* ── Public admin routes ── */
router.use("/auth", authRoutes);

/* ── All routes below require valid admin token ── */
router.use(verifyAdmin);

/* ── Dashboard Stats ── */
router.get("/stats", async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const [users, active, banned, todayU, prods, pending, todayP, orders, todayO, rev, todayRev, daily] = await Promise.all([
      req.app.locals.pool.query(`SELECT COUNT(*) FROM public.users`),
      req.app.locals.pool.query(`SELECT COUNT(*) FROM public.users WHERE status != 'banned'`),
      req.app.locals.pool.query(`SELECT COUNT(*) FROM public.users WHERE status = 'banned'`),
      req.app.locals.pool.query(`SELECT COUNT(*) FROM public.users WHERE created_at >= $1`, [today]),
      req.app.locals.pool.query(`SELECT COUNT(*) FROM market.products`),
      req.app.locals.pool.query(`SELECT COUNT(*) FROM market.products WHERE status = 'pending'`),
      req.app.locals.pool.query(`SELECT COUNT(*) FROM market.products WHERE created_at >= $1`, [today]),
      req.app.locals.pool.query(`SELECT COUNT(*) FROM orders`).catch(()=>({rows:[{count:0}]})),
      req.app.locals.pool.query(`SELECT COUNT(*) FROM orders WHERE created_at >= $1`, [today]).catch(()=>({rows:[{count:0}]})),
      req.app.locals.pool.query(`SELECT COALESCE(SUM(amount),0) AS revenue FROM payments WHERE status IN ('success','completed','paid')`),
      req.app.locals.pool.query(`SELECT COALESCE(SUM(amount),0) AS revenue FROM payments WHERE status IN ('success','completed','paid') AND created_at >= $1`, [today]),
      req.app.locals.pool.query(`SELECT DATE(created_at) AS date, COALESCE(SUM(amount),0) AS amount FROM payments WHERE status IN ('success','completed','paid') AND created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY date ASC`),
    ]);
    res.json({
      users: Number(users.rows[0].count), activeUsers: Number(active.rows[0].count),
      bannedUsers: Number(banned.rows[0].count), todayUsers: Number(todayU.rows[0].count),
      totalProducts: Number(prods.rows[0].count), pendingProducts: Number(pending.rows[0].count),
      todayProducts: Number(todayP.rows[0].count), orders: Number(orders.rows[0].count),
      todayOrders: Number(todayO.rows[0].count), revenue: Number(rev.rows[0].revenue),
      todayRevenue: Number(todayRev.rows[0].revenue),
      dailySales: daily.rows.map(r => ({ date: r.date, amount: Number(r.amount) }))
    });
  } catch (err) {
    console.error("[ADMIN Stats]", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── Mount feature routes ── */
router.use("/users", userRoutes);
router.use("/products", marketRoutes);          // ✅ market.products
router.use("/products/legacy", legacyRoutes);   // 🗑️ public.products (deprecated)
router.use("/payments", paymentRoutes);
router.use("/orders", orderRoutes);
router.use("/reports", reportRoutes);
router.use("/system", systemRoutes);
router.use("/roles", roleRoutes);

export default router;