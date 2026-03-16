// src/services/api.js
import axios from "axios";

const API_BASE = "https://minimart-ivrm.onrender.com/api/marketplace";

// Fetch products
export async function fetchProducts({ skip = 0, limit = 20, search } = {}) {
  try {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
    });

    if (search) {
      params.append("search", search);
    }

    const { data } = await axios.get(`${API_BASE}/products?${params}`);

    return data.products || data || [];
  } catch (error) {
    console.error("Fetch products error:", error);
    return [];
  }
}

// Fetch trending products
export async function fetchTrending() {
  try {
    const { data } = await axios.get(`${API_BASE}/trending`);
    return data || [];
  } catch (error) {
    console.error("Fetch trending error:", error);
    return [];
  }
}

// Fetch single product
export async function fetchProductById(id) {
  try {
    const { data } = await axios.get(`${API_BASE}/products/${id}`);
    return data || null;
  } catch (error) {
    console.error("Fetch product error:", error);
    return null;
  }
}