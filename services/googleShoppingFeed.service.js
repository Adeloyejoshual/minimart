// services/googleShoppingFeed.service.js

import { pool } from "../server.js";

const SITE_URL = process.env.SITE_URL || "https://www.loemart.com";
const IMAGE_BASE_URL =
  process.env.R2_PUBLIC_URL || "https://images.loemart.com";

const formatImageUrl = (rawPath) => {
  if (!rawPath || typeof rawPath !== "string") return null;

  let cleanPath = rawPath.trim();
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

const getProductImages = (product) => {
  const imagesList = [];
  if (product.image_url) imagesList.push(product.image_url);

  if (product.images) {
    try {
      const parsed =
        typeof product.images === "string"
          ? JSON.parse(product.images)
          : product.images;

      if (Array.isArray(parsed)) {
        parsed.forEach((img) => {
          const url = typeof img === "object" ? img?.url || img?.src : img;
          if (url && typeof url === "string") imagesList.push(url);
        });
      }
    } catch {
      /* ignore json parse errors */
    }
  }

  const uniqueUrls = [...new Set(imagesList)]
    .map(formatImageUrl)
    .filter(Boolean);

  return {
    mainImage: uniqueUrls[0] || null,
    additionalImages: uniqueUrls.slice(1, 11),
  };
};

const getProductUrl = (product) => {
  const path = product.slug
    ? `/market/product/${encodeURIComponent(product.slug)}`
    : `/market/product/${encodeURIComponent(product.id)}`;
  return `${SITE_URL}${path}`;
};

export const getGoogleShoppingProducts = async () => {
  const result = await pool.query(`
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