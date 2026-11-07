// services/googleShoppingFeed.service.js

const db = require("../config/db");

const SITE_URL = "https://www.loemart.com";
const IMAGE_BASE_URL =
  process.env.R2_PUBLIC_URL || "https://images.loemart.com";

/**
 * Normalizes image paths into absolute HTTPS URLs
 */
const formatImageUrl = (rawPath) => {
  if (!rawPath || typeof rawPath !== "string") return null;

  let cleanPath = rawPath.trim();

  // Ensure HTTPS protocol
  if (cleanPath.startsWith("http://")) {
    cleanPath = cleanPath.replace("http://", "https://");
  }

  if (cleanPath.startsWith("https://")) {
    return cleanPath;
  }

  if (cleanPath.startsWith("/")) {
    return `${SITE_URL}${cleanPath}`;
  }

  return `${IMAGE_BASE_URL}/${cleanPath.replace(/^\/+/, "")}`;
};

/**
 * Extracts main image and up to 10 gallery images for Google Lens matching
 */
const getProductImages = (product) => {
  const imagesList = [];

  // Add primary image link if exists
  if (product.image_url) {
    imagesList.push(product.image_url);
  }

  // Parse JSON gallery images if available
  if (product.images) {
    try {
      const parsedImages =
        typeof product.images === "string"
          ? JSON.parse(product.images)
          : product.images;

      if (Array.isArray(parsedImages)) {
        parsedImages.forEach((img) => {
          const url = typeof img === "object" ? img?.url || img?.src : img;
          if (url && typeof url === "string") {
            imagesList.push(url);
          }
        });
      }
    } catch (err) {
      // Ignore JSON parse errors silently
    }
  }

  // Deduplicate and convert to absolute HTTPS URLs
  const uniqueUrls = [...new Set(imagesList)]
    .map(formatImageUrl)
    .filter(Boolean);

  return {
    mainImage: uniqueUrls[0] || null,
    additionalImages: uniqueUrls.slice(1, 11), // Google accepts up to 10 extra images
  };
};

const getProductUrl = (product) => {
  const path = product.slug
    ? `/market/product/${encodeURIComponent(product.slug)}`
    : `/market/product/${encodeURIComponent(product.id)}`;

  return `${SITE_URL}${path}`;
};

const getGoogleShoppingProducts = async () => {
  const result = await db.query(`
    SELECT
      id,
      name,
      description,
      price,
      image_url,
      images,
      slug,
      brand,
      status,
      stock_quantity
    FROM market.products
    WHERE
      status = 'active'
      AND price > 0
    ORDER BY created_at DESC
    LIMIT 50000
  `);

  return result.rows
    .map((product) => {
      const { mainImage, additionalImages } = getProductImages(product);
      const price = Number(product.price);

      // Validate mandatory fields required by Google Merchant Center
      if (
        !product.id ||
        !product.name ||
        !product.description ||
        !mainImage ||
        !Number.isFinite(price) ||
        price <= 0
      ) {
        return null;
      }

      // Format availability based on stock count
      const stock = Number(product.stock_quantity);
      const availability =
        Number.isFinite(stock) && stock > 0 ? "in_stock" : "out_of_stock";

      return {
        id: String(product.id),
        title: product.name,
        description: product.description,
        price,
        image: mainImage,
        additionalImages,
        url: getProductUrl(product),
        brand: product.brand || "Loemart",
        availability,
      };
    })
    .filter(Boolean);
};

module.exports = {
  getGoogleShoppingProducts,
};