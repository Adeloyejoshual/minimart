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

// Fetch a single Marketplace product by ID
export const getMarketplaceProductById = async (id) => {
  try {
    // Option 1: If your backend supports fetching by ID
    const res = await axios.get(`/api/marketplace/${id}`);
    return res.data;

    // Option 2: If backend doesn't support single fetch
    // const all = await getMarketplaceProducts();
    // return all.find(p => String(p._id) === String(id));

  } catch (err) {
    console.error(`Failed to fetch Marketplace product with ID ${id}:`, err);
    return null;
  }
};