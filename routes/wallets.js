// src/routes/wallets.js
const { Router } = require("express");
const { body, param, query: qv, validationResult } = require("express-validator");
const walletService = require("../services/walletService");

const router = Router();

// ─── Validation helpers ───────────────────────────────────────────────────────

const uuidParam = (name) =>
  param(name).isUUID().withMessage(`${name} must be a valid UUID`);

const positiveAmount = (field = "amount") =>
  body(field)
    .isFloat({ gt: 0 })
    .withMessage("amount must be a positive number")
    .toFloat();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ success: false, errors: errors.array() });
  next();
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /wallets
 * List all wallets with optional query params:
 *   ?search=  &status=active|suspended  &verified=true  &hasPending=true
 *   &limit=50  &offset=0
 */
router.get("/", async (req, res, next) => {
  try {
    const { search, status, verified, hasPending, limit, offset } = req.query;
    const result = await walletService.listWallets({
      search,
      status,
      verified,
      hasPending,
      limit: Math.min(parseInt(limit) || 50, 200),
      offset: parseInt(offset) || 0,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /wallets/summary
 * Platform-wide totals for admin dashboard.
 */
router.get("/summary", async (req, res, next) => {
  try {
    const summary = await walletService.getPlatformSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /wallets/:id
 * Single wallet by wallet UUID.
 */
router.get("/:id", [uuidParam("id"), validate], async (req, res, next) => {
  try {
    const wallet = await walletService.getWalletById(req.params.id);
    if (!wallet) return res.status(404).json({ success: false, message: "Wallet not found" });
    res.json({ success: true, data: wallet });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /wallets/user/:userId
 * Wallet by user UUID.
 */
router.get(
  "/user/:userId",
  [uuidParam("userId"), validate],
  async (req, res, next) => {
    try {
      const wallet = await walletService.getWalletByUserId(req.params.userId);
      if (!wallet) return res.status(404).json({ success: false, message: "Wallet not found" });
      res.json({ success: true, data: wallet });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /wallets
 * Create a wallet for a user.
 * Body: { user_id }
 */
router.post(
  "/",
  [body("user_id").isUUID().withMessage("user_id must be a valid UUID"), validate],
  async (req, res, next) => {
    try {
      const { wallet, created } = await walletService.createWallet(req.body.user_id);
      res.status(created ? 201 : 200).json({ success: true, data: wallet, created });
    } catch (err) {
      // FK violation = user does not exist
      if (err.code === "23503")
        return res.status(404).json({ success: false, message: "User not found" });
      next(err);
    }
  }
);

/**
 * POST /wallets/:id/credit
 * Add funds to pending (e.g. order completed).
 * Body: { amount, description?, reference_id? }
 */
router.post(
  "/:id/credit",
  [uuidParam("id"), positiveAmount(), validate],
  async (req, res, next) => {
    try {
      const { amount, description, reference_id } = req.body;
      const wallet = await walletService.creditPending(req.params.id, amount, {
        description,
        referenceId: reference_id,
      });
      res.json({ success: true, data: wallet });
    } catch (err) {
      if (err.message === "Wallet not found")
        return res.status(404).json({ success: false, message: err.message });
      next(err);
    }
  }
);

/**
 * POST /wallets/:id/release
 * Move pending → available. Omit amount to release all pending.
 * Body: { amount?, description?, reference_id? }
 */
router.post(
  "/:id/release",
  [
    uuidParam("id"),
    body("amount")
      .optional()
      .isFloat({ gt: 0 })
      .withMessage("amount must be a positive number")
      .toFloat(),
    validate,
  ],
  async (req, res, next) => {
    try {
      const { amount, description, reference_id } = req.body;
      const wallet = await walletService.releasePending(
        req.params.id,
        amount !== undefined ? amount : null,
        { description, referenceId: reference_id }
      );
      res.json({ success: true, data: wallet });
    } catch (err) {
      if (err.message.includes("not found"))
        return res.status(404).json({ success: false, message: err.message });
      if (err.message.includes("exceeds") || err.message.includes("No pending"))
        return res.status(409).json({ success: false, message: err.message });
      next(err);
    }
  }
);

/**
 * POST /wallets/:id/withdraw
 * Deduct from available balance (payout request).
 * Body: { amount, description?, reference_id? }
 */
router.post(
  "/:id/withdraw",
  [uuidParam("id"), positiveAmount(), validate],
  async (req, res, next) => {
    try {
      const { amount, description, reference_id } = req.body;
      const wallet = await walletService.withdraw(req.params.id, amount, {
        description,
        referenceId: reference_id,
      });
      res.json({ success: true, data: wallet });
    } catch (err) {
      if (err.message.includes("not found"))
        return res.status(404).json({ success: false, message: err.message });
      if (err.message.includes("Insufficient"))
        return res.status(409).json({ success: false, message: err.message });
      next(err);
    }
  }
);

/**
 * POST /wallets/:id/refund
 * Reverse a charge (deduct from available or pending).
 * Body: { amount, from_pending?, description?, reference_id? }
 */
router.post(
  "/:id/refund",
  [uuidParam("id"), positiveAmount(), validate],
  async (req, res, next) => {
    try {
      const { amount, from_pending, description, reference_id } = req.body;
      const wallet = await walletService.refund(req.params.id, amount, {
        fromPending: from_pending === true,
        description,
        referenceId: reference_id,
      });
      res.json({ success: true, data: wallet });
    } catch (err) {
      if (err.message.includes("not found"))
        return res.status(404).json({ success: false, message: err.message });
      if (err.message.includes("Insufficient"))
        return res.status(409).json({ success: false, message: err.message });
      next(err);
    }
  }
);

/**
 * GET /wallets/:id/transactions
 * Paginated transaction history.
 * ?type=credit|debit|release|withdrawal|refund  &limit=20  &offset=0
 */
router.get(
  "/:id/transactions",
  [uuidParam("id"), validate],
  async (req, res, next) => {
    try {
      const { type, limit, offset } = req.query;
      const result = await walletService.getTransactions(req.params.id, {
        type,
        limit: Math.min(parseInt(limit) || 20, 100),
        offset: parseInt(offset) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;