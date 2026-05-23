import express from "express";
import { verifyAdmin, requireSuperAdmin } from "./middleware.js";

const router = express.Router();

/* Import all route modules */
import authRoutes          from "./auth.routes.js";
import userRoutes          from "./users.routes.js";
import legacyProductRoutes from "./products.routes.js";
import marketProductRoutes from "./marketproducts.js";
import paymentRoutes       from "./payments.routes.js";
import orderRoutes         from "./orders.routes.js";
import reportRoutes        from "./reports.routes.js";
import systemRoutes        from "./system.routes.js";
import roleRoutes          from "./roles.routes.js";

/* ────────────────────────────────────────────
   PUBLIC ROUTES (no auth required)
──────────────────────────────────────────── */
router.use("/auth", authRoutes);

/* ────────────────────────────────────────────
   PROTECTED ROUTES (require admin auth)
──────────────────────────────────────────── */
router.use(verifyAdmin);

router.use("/users", userRoutes);

/* ✅ Perfect schema separation */
router.use("/products/legacy", legacyProductRoutes); // public.products
router.use("/products", marketProductRoutes);         // market.products ✅

router.use("/payments", paymentRoutes);
router.use("/orders", orderRoutes);
router.use("/reports", reportRoutes);
router.use("/system", systemRoutes);

/* ────────────────────────────────────────────
   SUPER ADMIN ONLY
──────────────────────────────────────────── */
router.use(requireSuperAdmin);

router.use("/roles", roleRoutes);

export default router;