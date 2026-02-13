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