import { Router } from "express";
import { body, param, validationResult } from "express-validator";

import {
  listWallets,
  getWalletById,
  getWalletByUserId,
  createWallet,
  creditPending,
  releasePending,
  withdraw,
  refund,
  getTransactions,
  getPlatformSummary,
} from "../services/walletService.js";

const router = Router();

// ─────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────

const uuidParam = (name) =>
  param(name).isUUID().withMessage(`${name} must be a valid UUID`);

const positiveAmount = (field = "amount") =>
  body(field)
    .isFloat({ gt: 0 })
    .withMessage("amount must be a positive number")
    .toFloat();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      errors: errors.array(),
    });
  }
  next();
}

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

router.get("/", async (req, res, next) => {
  try {
    const { search, status, verified, hasPending, limit, offset } = req.query;

    const result = await listWallets({
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

router.get("/summary", async (req, res, next) => {
  try {
    const summary = await getPlatformSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", [uuidParam("id"), validate], async (req, res, next) => {
  try {
    const wallet = await getWalletById(req.params.id);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    res.json({ success: true, data: wallet });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/user/:userId",
  [uuidParam("userId"), validate],
  async (req, res, next) => {
    try {
      const wallet = await getWalletByUserId(req.params.userId);

      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: "Wallet not found",
        });
      }

      res.json({ success: true, data: wallet });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/",
  [body("user_id").isUUID().withMessage("user_id must be a valid UUID"), validate],
  async (req, res, next) => {
    try {
      const { wallet, created } = await createWallet(req.body.user_id);

      res.status(created ? 201 : 200).json({
        success: true,
        data: wallet,
        created,
      });
    } catch (err) {
      if (err.code === "23503") {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      next(err);
    }
  }
);

router.post(
  "/:id/credit",
  [uuidParam("id"), positiveAmount(), validate],
  async (req, res, next) => {
    try {
      const { amount, description, reference_id } = req.body;

      const wallet = await creditPending(req.params.id, amount, {
        description,
        referenceId: reference_id,
      });

      res.json({ success: true, data: wallet });
    } catch (err) {
      if (err.message === "Wallet not found") {
        return res.status(404).json({ success: false, message: err.message });
      }
      next(err);
    }
  }
);

router.post(
  "/:id/release",
  [
    uuidParam("id"),
    body("amount")
      .optional()
      .isFloat({ gt: 0 })
      .toFloat()
      .withMessage("amount must be a positive number"),
    validate,
  ],
  async (req, res, next) => {
    try {
      const { amount, description, reference_id } = req.body;

      const wallet = await releasePending(
        req.params.id,
        amount !== undefined ? amount : null,
        {
          description,
          referenceId: reference_id,
        }
      );

      res.json({ success: true, data: wallet });
    } catch (err) {
      if (err.message.includes("not found")) {
        return res.status(404).json({ success: false, message: err.message });
      }

      if (
        err.message.includes("exceeds") ||
        err.message.includes("No pending")
      ) {
        return res.status(409).json({
          success: false,
          message: err.message,
        });
      }

      next(err);
    }
  }
);

router.post(
  "/:id/withdraw",
  [uuidParam("id"), positiveAmount(), validate],
  async (req, res, next) => {
    try {
      const { amount, description, reference_id } = req.body;

      const wallet = await withdraw(req.params.id, amount, {
        description,
        referenceId: reference_id,
      });

      res.json({ success: true, data: wallet });
    } catch (err) {
      if (err.message.includes("not found")) {
        return res.status(404).json({ success: false, message: err.message });
      }

      if (err.message.includes("Insufficient")) {
        return res.status(409).json({
          success: false,
          message: err.message,
        });
      }

      next(err);
    }
  }
);

router.post(
  "/:id/refund",
  [uuidParam("id"), positiveAmount(), validate],
  async (req, res, next) => {
    try {
      const { amount, from_pending, description, reference_id } = req.body;

      const wallet = await refund(req.params.id, amount, {
        fromPending: from_pending === true,
        description,
        referenceId: reference_id,
      });

      res.json({ success: true, data: wallet });
    } catch (err) {
      if (err.message.includes("not found")) {
        return res.status(404).json({ success: false, message: err.message });
      }

      if (err.message.includes("Insufficient")) {
        return res.status(409).json({
          success: false,
          message: err.message,
        });
      }

      next(err);
    }
  }
);

router.get(
  "/:id/transactions",
  [uuidParam("id"), validate],
  async (req, res, next) => {
    try {
      const { type, limit, offset } = req.query;

      const result = await getTransactions(req.params.id, {
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