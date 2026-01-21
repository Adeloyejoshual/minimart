// -------------------- Imports --------------------
const express = require("express");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto"); // For verifying Paystack signature
const locationsRouter = require("./api/locations"); // Your API routes
const { updateProductPromotion } = require("./api/products"); // Function to update product in DB

// -------------------- App Setup --------------------
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON
app.use(express.json());

// -------------------- API Routes --------------------
app.use("/api/locations", locationsRouter);

// -------------------- Paystack Webhook --------------------
// Paystack sends POST requests here after payment
app.post("/api/paystack/webhook", (req, res) => {
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

  // Get Paystack signature from headers
  const paystackSignature = req.headers["x-paystack-signature"];

  // Compute hash of the request body
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest("hex");

  // Verify signature
  if (hash !== paystackSignature) {
    console.log("⚠️ Invalid Paystack signature");
    return res.status(400).send("Invalid signature");
  }

  const event = req.body;

  if (event.event === "charge.success") {
    const { reference, amount, customer, metadata } = event.data;

    console.log(`✅ Payment verified: ${reference} - ${amount / 100} NGN`);

    // metadata should include productId and promotionPlanId from frontend
    if (metadata?.productId && metadata?.promotionPlanId) {
      // Update the product in your DB as promoted
      updateProductPromotion(metadata.productId, metadata.promotionPlanId)
        .then(() => console.log("Product promotion updated"))
        .catch(err => console.error("Failed to update product promotion:", err));
    }
  }

  // Respond to Paystack
  res.sendStatus(200);
});

// -------------------- Serve React Frontend --------------------
app.use(express.static(path.join(__dirname, "../build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../build", "index.html"));
});

// -------------------- Start Server --------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});