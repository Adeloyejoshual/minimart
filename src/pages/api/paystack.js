// pages/api/paystack.js
import Paystack from "paystack-node";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { email, amount, productPayload } = req.body;

  if (!email || !amount || !productPayload) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY);

    const response = await paystack.transaction.initialize({
      email,
      amount: Math.round(amount * 100), // kobo
      metadata: { product: productPayload },
      callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment-callback`,
    });

    return res.status(200).json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}