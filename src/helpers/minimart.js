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