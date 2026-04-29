// src/pages/product/api/productApi.js
const BASE = "https://minimart-ivrm.onrender.com";

export async function fetchCategories() {
  const res = await fetch(`${BASE}/api/marketplace/categories`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function createProduct(token, formData) {
  const res = await fetch(`${BASE}/api/marketplace/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return JSON.parse(text).product;
}

export async function deleteProduct(token, productId) {
  await fetch(`${BASE}/api/marketplace/products/${productId}`, {
    method: "DELETE",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
  });
}