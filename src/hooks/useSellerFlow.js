// routes/sellerOnboarding.routes.js
// ── In POST /setup-store — update VENDOR_EXISTS response ──────

if (existing.length && !isReapply) {
  await client.query("ROLLBACK");
  return res.status(409).json({
    success: false,
    code:    "VENDOR_EXISTS",
    message: "Store already exists",
    status:  existing[0].status,  // ✅ Already there — confirm it's included
    vendor: {
      id:     existing[0].id,
      status: existing[0].status,
    },
  });
}