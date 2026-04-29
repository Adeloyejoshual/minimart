// src/pages/product/api/paymentApi.js
const BASE = "https://minimart-ivrm.onrender.com";

export async function initPayment(token, payload) {
  const res = await fetch(`${BASE}/api/payment/initiate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  const data = JSON.parse(text);

  if (!res.ok || !data.success || !data.authorization_url) {
    throw new Error(data.message || "Payment initialization failed");
  }

  return { reference: data.reference, authUrl: data.authorization_url };
}

export async function activateFreeProduct(token, productId, promotionId) {
  const res = await fetch(`${BASE}/api/marketplace/products/${productId}/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ promotion_id: promotionId }),
  });

  const text = await res.text();
  const data = JSON.parse(text);

  if (!res.ok || !data.success) {
    throw new Error(data.message || "Product activation failed");
  }

  return data;
}