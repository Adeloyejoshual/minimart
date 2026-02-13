// src/helpers/marketplace.js
import axios from "axios";

// Fetch all Marketplace products
export const getMarketplaceProducts = async () => {
  try {
    const res = await axios.get("/api/marketplace");
    return res.data;
  } catch (err) {
    console.error("Failed to fetch Marketplace products:", err);
    return [];
  }
};

// ✅ Fetch one Marketplace product by ID
export const getMarketplaceProductById = async (id) => {
  try {
    const res = await axios.get(`/api/marketplace/${id}`);
    return res.data;
  } catch (err) {
    console.error(`Failed to fetch Marketplace product ${id}:`, err);
    return null;
  }
};