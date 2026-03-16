import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE || "https://minimart-ivrm.onrender.com/api/marketplace";

export const fetchProducts = async ({ skip = 0, limit = 20, search = "" }) => {
  const params = { skip, limit, ...(search && { search }) };
  const { data } = await axios.get(`${API_BASE}/products`, { params });
  return data.products || data;
};

export const fetchTrending = async () => {
  const { data } = await axios.get(`${API_BASE}/trending`);
  return data || [];
};