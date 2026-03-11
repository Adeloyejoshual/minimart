import axios from "axios";

const API = axios.create({
  baseURL: "/api",
});

export const getProducts = () => API.get("/marketplace");
export const getProduct = (id) => API.get(`/marketplace/${id}`);
export const addProduct = (data) => API.post("/marketplace", data);