// src/helpers/marketplaceApi.js
import api from "../utils/api";

// Base API URL from environment
const API_BASE = import.meta.env.VITE_API_URL || "/api/marketplace";

/**
 * GET ALL PRODUCTS (with optional filters)
 */
export const getMarketplaceProducts = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const url = `${API_BASE}${params ? `?${params}` : ""}`;
  const res = await api.get(url);
  return res.data.products || [];
};

/**
 * GET ONE PRODUCT BY ID
 */
export const getMarketplaceProductById = async (id) => {
  const res = await api.get(`${API_BASE}/${id}`);
  return res.data;
};

/**
 * ADD NEW PRODUCT
 */
export const addMarketplaceProduct = async (data, token) => {
  const res = await api.post(API_BASE, data, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return res.data;
};

/**
 * DELETE PRODUCT BY ID
 */
export const deleteMarketplaceProduct = async (id, token) => {
  const res = await api.delete(`${API_BASE}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};