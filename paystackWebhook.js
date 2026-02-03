const crypto = require("crypto");

module.exports = (req, res, io) => {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(req.body)
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"])
    return res.status(400).send("Invalid signature");

  const event = JSON.parse(req.body);
  const { metadata } = event.data;

  if (event.event === "charge.success") {
    if (metadata?.userId && metadata?.walletAmount) {
      io.to(metadata.userId).emit("walletUpdated", { balance: metadata.walletAmount });
    }
  }

  res.sendStatus(200);
};