// src/utils/api.js
import axios from "axios";

// Use environment variable for API URL, fallback to relative path
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/marketplace",
});

export default api;