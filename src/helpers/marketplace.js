import api from "../utils/api";

// GET ALL (with filters, pagination)
export const getMarketplaceProducts = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const res = await api.get(`/api/marketplace${params ? `?${params}` : ""}`);
  return res.data.products || [];
};

// GET ONE
export const getMarketplaceProductById = async (id) => {
  const res = await api.get(`/api/marketplace/${id}`);
  return res.data;
};

// ADD (JSON only)
export const addMarketplaceProduct = async (data, token) => {
  const res = await api.post("/api/marketplace", data, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return res.data;
};

// DELETE
export const deleteMarketplaceProduct = async (id, token) => {
  const res = await api.delete(`/api/marketplace/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};