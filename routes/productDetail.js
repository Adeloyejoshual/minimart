// routes/productDetailRouter.js
const express = require("express");
const router = express.Router();

// Example DB helper (you’ll replace this with your Cockroach/Supabase query)
const db = {
  async getProductById(id) {
    // Pseudocode; replace with your SQL / ORM
    // return await db.query('SELECT * FROM products WHERE id = $1', [id]);
    return [
      {
        id: "c3a4b5c6-d7e8-4f9a-b0c1-234567890123",
        title: "Example Product",
        description: "This is a sample product.",
        price: 25000,
        category_id: "123e4567-e89b-12d3-a456-426614174000",
        seller_id: "876e4567-e89b-12d3-a456-426614174000",
        status: "active",
        is_active: true,
        main_image: "https://via.placeholder.com/600x400.png?text=Product",
        thumbnail_url: "https://via.placeholder.com/300x200.png?text=Thumb",
        attributes: { brand: "BrandX", model: "Model‑Y" },
        specifications: { "Screen Size": "6.5 inches" },
        highlights: ["High quality", "Fast delivery"],
        faq: [
          { question: "Delivery time?", answer: "3–5 days" },
        ],
        location_state: "Lagos",
        location_city: "Lekki",
        latitude: 6.4281,
        longitude: 3.4215,
        whatsapp: "+2348012345678",
        whatsapp_link: "https://wa.me/2348012345678",
        phone: "+2348012345678",
        views: 100,
        favorites_count: 8,
        promotion_priority: 1,
      },
    ].find((p) => p.id === id);
  },
};

// GET /api/product/:id
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const product = await db.getProductById(id);

    if (!product) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    return res.json(product);
  } catch (err) {
    console.error("[productDetailRouter] Error:", err);
    return res.status(500).json({
      error: "Failed to fetch product",
    });
  }
});

module.exports = router;