/**
 * routes/cart/index.js
 *
 * Combines all cart sub-routers.
 * Mounted in app.js as:
 *   app.use("/api/cart", cartRouter);
 *
 * Auth: authenticateBuyer — public.users (buyers only)
 *
 * Routes exposed:
 *   GET    /api/cart              → cartRead   (fetch cart)
 *   POST   /api/cart/items        → cartWrite  (add item)
 *   PATCH  /api/cart/items/:id    → cartWrite  (update qty)
 *   DELETE /api/cart/items/:id    → cartWrite  (remove item)
 *   DELETE /api/cart              → cartWrite  (clear cart)
 */

import express   from "express";
import cartRead  from "./read.js";
import cartWrite from "./write.js";

const router = express.Router();

/* Order matters:
   - read.js handles GET /
   - write.js handles POST/PATCH/DELETE on items
   Both mount at "/" so the paths inside each file define
   the final URL. */
router.use("/", cartRead);
router.use("/", cartWrite);

export default router;