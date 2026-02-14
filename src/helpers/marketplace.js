// src/helpers/marketplace.js
import axios from "axios";

export const getMarketplaceProducts = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const res = await axios.get(`/api/marketplace${params ? `?${params}` : ""}`);
  return res.data;
};

export const getMarketplaceProductById = async (id) => {
  const res = await axios.get(`/api/marketplace/${id}`);
  return res.data;
};

export const addMarketplaceProduct = async (formData, token) => {
  const res = await axios.post("/api/marketplace", formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};

export const deleteMarketplaceProduct = async (id, token) => {
  const res = await axios.delete(`/api/marketplace/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};