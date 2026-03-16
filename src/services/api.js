// services/api.ts
import axios from "axios";

const API_BASE = "https://minimart-ivrm.onrender.com/api/marketplace";

interface FetchProductsParams {
  skip?: number;
  limit?: number;
  search?: string;
}

export async function fetchProducts({ skip = 0, limit = 20, search }: FetchProductsParams) {
  try {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
      ...(search && { search }),
    });

    const { data } = await axios.get(`${API_BASE}/products?${params}`);
    // Expecting API to return { products: [...] } or array directly
    return data.products || data;
  } catch (err: any) {
    console.error("Error fetching products:", err);
    return [];
  }
}

export async function fetchTrending() {
  try {
    const { data } = await axios.get(`${API_BASE}/trending`);
    return data || [];
  } catch (err: any) {
    console.error("Error fetching trending products:", err);
    return [];
  }
}

export async function fetchProductById(id: string) {
  try {
    const { data } = await axios.get(`${API_BASE}/products/${id}`);
    return data || null;
  } catch (err: any) {
    console.error(`Error fetching product ${id}:`, err);
    return null;
  }
}