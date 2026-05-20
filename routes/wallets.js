import { Router } from "express";
import { body, param, validationResult } from "express-validator";
import * as walletService from "../services/walletService.js";

const router = Router();

/* ─────────────────────────────────────────────
   Validation Helpers
───────────────────────────────────────────── */

const uuidParam = (name) =>
  param(name).isUUID().withMessage(`${name} must be a valid UUID`);

const positiveAmount = (field = "amount") =>
  body(field)
    .isFloat({ gt: 0 })
    .withMessage(`${field} must be a positive number`)
    .toFloat();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      errors: errors.array(),
    });
  }
  next();
};

/* ─────────────────────────────────────────────
   Routes
───────────────────────────────────────────── */

// List wallets
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

// Platform summary
router.get("/summary", async (req, res, next) => {
  try {
    const summary = await walletService.getPlatformSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

// Get wallet by ID
router.get("/:id", [uuidParam("id"), validate], async (req, res, next) => {
  try {
    const wallet = await walletService.getWalletById(req.params.id);
    if (!wallet)
      return res.status(404).json({ success: false, message: "Wallet not found" });

    res.json({ success: true, data: wallet });
  } catch (err) {
    next(err);
  }
});

// Get wallet by user ID
router.get(
  "/user/:userId",
  [uuidParam("userId"), validate],
  async (req, res, next) => {
    try {
      const wallet = await walletService.getWalletByUserId(req.params.userId);
      if (!wallet)
        return res.status(404).json({ success: false, message: "Wallet not found" });

      res.json({ success: true, data: wallet });
    } catch (err) {
      next(err);
    }
  }
);

// Create wallet
router.post(
  "/",
  [body("user_id").isUUID().withMessage("user_id must be a valid UUID"), validate],
  async (req, res, next) => {
    try {
      const { wallet, created } = await walletService.createWallet(req.body.user_id);

      res.status(created ? 201 : 200).json({
        success: true,
        data: wallet,
        created,
      });
    } catch (err) {
      if (err.code === "23503") {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      next(err);
    }
  }
);

// Credit pending
router.post(
  "/:id/credit",
  [uuidParam("id"), positiveAmount(), validate],
  async (req, res, next) => {
    try {
      const wallet = await walletService.creditPending(
        req.params.id,
        req.body.amount,
        req.body
      );
      res.json({ success: true, data: wallet });
    } catch (err) {
      handleWalletError(err, res, next);
    }
  }
);

// Release pending
router.post(
  "/:id/release",
  [
    uuidParam("id"),
    body("amount").optional().isFloat({ gt: 0 }).toFloat(),
    validate,
  ],
  async (req, res, next) => {
    try {
      const wallet = await walletService.releasePending(
        req.params.id,
        req.body.amount ?? null,
        req.body
      );
      res.json({ success: true, data: wallet });
    } catch (err) {
      handleWalletError(err, res, next);
    }
  }
);

// Withdraw
router.post(
  "/:id/withdraw",
  [uuidParam("id"), positiveAmount(), validate],
  async (req, res, next) => {
    try {
      const wallet = await walletService.withdraw(
        req.params.id,
        req.body.amount,
        req.body
      );
      res.json({ success: true, data: wallet });
    } catch (err) {
      handleWalletError(err, res, next);
    }
  }
);

// Refund
router.post(
  "/:id/refund",
  [uuidParam("id"), positiveAmount(), validate],
  async (req, res, next) => {
    try {
      const wallet = await walletService.refund(
        req.params.id,
        req.body.amount,
        req.body
      );
      res.json({ success: true, data: wallet });
    } catch (err) {
      handleWalletError(err, res, next);
    }
  }
);

// Transactions
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

/* ─────────────────────────────────────────────
   Shared Error Handler
───────────────────────────────────────────── */

function handleWalletError(err, res, next) {
  if (err.message.includes("not found"))
    return res.status(404).json({ success: false, message: err.message });

  if (
    err.message.includes("Insufficient") ||
    err.message.includes("exceeds") ||
    err.message.includes("No pending")
  )
    return res.status(409).json({ success: false, message: err.message });

  next(err);
}

export default router;