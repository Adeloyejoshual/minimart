// utils/normalizeProduct.js

export const normalizeProduct = (product) => {
  if (!product) return null;

  return {
    id: product.id,
    title: product.title,
    description: product.description || "",
    price: Number(product.price),
    category_id: product.category_id,
    subcategory_id: product.subcategory_id,

    location: {
      state: product.location_state || null,
      city: product.location_city || null,
    },

    media: product.media || { images: [], videos: [] },

    attributes: product.attributes || {},

    delivery: product.delivery || {},

    contact: product.contact || {},

    views: product.views || 0,
    slug: product.slug || null,

    is_active: product.is_active,
    status: product.status,

    created_at: product.created_at,
    updated_at: product.updated_at,
  };
};