const API_BASE = "https://minimart-ivrm.onrender.com/api/marketplace";

export const initiatePromotionPayment = async ({
  plan,
  productId,
  email,
}) => {
  const res = await fetch(`${API_BASE}/payments/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plan_id: plan.id,
      amount: plan.price,
      product_id: productId,
      email,
    }),
  });

  const data = await res.json();

  if (!data.status) throw new Error(data.message);

  // redirect to Paystack checkout
  window.location.href = data.data.authorization_url;

  return data;
};