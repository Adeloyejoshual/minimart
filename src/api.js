const BASE_URL = "https://my-backend.onrender.com";

export const getDBTime = async () => {
  const res = await fetch(`${BASE_URL}/test-db`);
  return res.json();
};

export const getProducts = async () => {
  const res = await fetch(`${BASE_URL}/products`);
  return res.json();
};

export const addProduct = async (name, price) => {
  const res = await fetch(`${BASE_URL}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, price }),
  });
  return res.json();
};