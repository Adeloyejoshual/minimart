import Paystack from "paystack-node";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { email, amount } = req.body;

  try {
    const paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY);
    const response = await paystack.transaction.initialize({ email, amount });
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}