// services/googleShoppingFeed.service.js

import { pool } from "../config/db.js";

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

const getProductUrl = (product) => {
  const path = product.slug
    ? `/market/product/${encodeURIComponent(product.slug)}`
    : `/market/product/${encodeURIComponent(product.id)}`;
  return `${SITE_URL}${path}`;
};

export const getGoogleShoppingProducts = async () => {
  try {
    // Uses ONLY verified columns from market.products, market.product_images, and market.users
    const query = `
      SELECT
        p.id,
        p.name                                AS title,
        p.description,
        p.price::numeric                      AS price,
        p.slug,
        u.name                                AS seller_name,

        -- Aggregated images from market.product_images
        COALESCE((
          SELECT json_agg(pi.image_url ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC)
          FROM market.product_images pi
          WHERE pi.product_id = p.id
        ), '[]'::json) AS db_images

      FROM market.products p
      LEFT JOIN market.users u ON u.id = p.user_id
      WHERE p.status IN ('approved', 'active')
        AND p.is_active = true
        AND p.is_hidden = false
        AND p.is_paused = false
        AND p.deleted_at IS NULL
        AND p.price::numeric > 0
      ORDER BY p.created_at DESC
      LIMIT 50000;
    `;

    const { rows } = await pool.query(query);

    const products = rows
      .map((p) => {
        const imageList = [];

        if (Array.isArray(p.db_images)) {
          p.db_images.forEach((url) => {
            if (url && typeof url === "string") {
              imageList.push(url);
            }
          });
        }

        const uniqueImages = [...new Set(imageList)]
          .map(formatImageUrl)
          .filter(Boolean);

        const mainImage = uniqueImages[0] || null;
        const additionalImages = uniqueImages.slice(1, 11);
        const price = Number(p.price);

        if (
          !p.id ||
          !p.title ||
          !p.description ||
          !mainImage ||
          !Number.isFinite(price) ||
          price <= 0
        ) {
          return null;
        }

        return {
          id: String(p.id),
          title: p.title,
          description: p.description,
          price,
          image: mainImage,
          additionalImages,
          url: getProductUrl(p),
          brand: p.seller_name || "Loemart",
          availability: "in_stock",
        };
      })
      .filter(Boolean);

    return products;
  } catch (error) {
    console.error("🔥 [Google Feed DB Error]:", error);
    throw error;
  }
};