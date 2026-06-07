// routes/debug/webhookLog.js
// Add this TEMPORARILY to catch the real FLW payload

import express from "express";
import { pool } from "../../server.js";

const router = express.Router();

// Store incoming webhook payloads in DB for inspection
router.post("/capture", express.raw({ type: "*/*" }), async (req, res) => {
  const raw  = req.body?.toString() ?? "";
  const body = (() => { try { return JSON.parse(raw); } catch { return {}; } })();

  console.log("=== CAPTURED FLW PAYLOAD ===");
  console.log(JSON.stringify({
    headers: req.headers,
    body:    body,
  }, null, 2));
  console.log("=== END PAYLOAD ===");

  // Also save to DB so you can inspect it
  try {
    await pool.query(
      `INSERT INTO market.webhook_logs
         (source, event, payload, headers, created_at)
       VALUES ('flutterwave', $1, $2, $3, NOW())`,
      [
        body?.event ?? "unknown",
        JSON.stringify(body),
        JSON.stringify(req.headers),
      ]
    );
  } catch {
    // Table might not exist — that's ok, check console logs
  }

  res.status(200).json({ captured: true });
});

// View captured logs
router.get("/logs", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, source, event, payload, headers, created_at
       FROM market.webhook_logs
       ORDER BY created_at DESC
       LIMIT 10`
    );
    res.json({ logs: rows });
  } catch {
    res.json({ logs: [], note: "webhook_logs table does not exist" });
  }
});

export default router;