import fetch from "node-fetch";

export const verifyPaystackTransaction = async (reference) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();

  if (!data.status) throw new Error(data.message || "Payment verification failed");

  // Return relevant info
  return {
    status: data.data.status,       // e.g., "success"
    amount: data.data.amount / 100, // Paystack sends in kobo
    reference: data.data.reference,
    email: data.data.customer.email,
  };
};