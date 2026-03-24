// services/paystack.js

export const handlePaystackWebhook = async (req, res) => {
  try {
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(400).send("Invalid signature");
    }

    const event = req.body;

    if (event.event === "charge.success") {
      const reference = event.data.reference;

      const verification = await verifyPaystackPayment(reference);

      if (!verification.success) {
        return res.status(400).send("Verification failed");
      }

      const metadata = verification.data.metadata || {};

      // =========================
      // CASE 1: Promote existing product
      // =========================
      if (metadata.product_id) {
        await pool.query(
          "UPDATE products SET promoted = TRUE WHERE id = $1",
          [metadata.product_id]
        );

        console.log(`✅ Existing product promoted: ${metadata.product_id}`);
      }

      // =========================
      // CASE 2: Pre-product promotion (NEW FLOW)
      // =========================
      if (metadata.temp_product) {
        // Save payment record for later use
        await pool.query(
          `
          INSERT INTO payments (reference, amount, metadata, status, created_at)
          VALUES ($1, $2, $3, $4, now())
          `,
          [
            reference,
            verification.data.amount,
            JSON.stringify(metadata),
            "success",
          ]
        );

        console.log(`✅ Payment stored for pending product creation`);
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(400).send("Webhook error");
  }
};