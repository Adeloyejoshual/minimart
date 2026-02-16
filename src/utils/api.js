import axios from "axios";

const api = axios.create({
  baseURL: window.location.origin, // ensures correct Render base
});

export default api;