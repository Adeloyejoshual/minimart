// src/helpers/minimart.js
import axios from "axios";

export const getMiniMartProducts = async () => {
  const res = await axios.get("/api/minimart");
  return res.data;
};

export const addMiniMartProduct = async (product) => {
  const res = await axios.post("/api/minimart", product);
  return res.data;
};

// ✅ Fetch single MiniMart product by ID
export const getMiniMartProductById = async (id) => {
  try {
    const res = await axios.get(`/api/minimart/${id}`);
    return res.data;
  } catch (err) {
    console.error(`Failed to fetch MiniMart product ${id}:`, err);
    return null;
  }
};