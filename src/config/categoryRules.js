export const categoryRules = {
  title: {
    required: true,
    minLength: 20,
    maxLength: 150,
    errorMessage: "Title must be between 20 and 150 characters",
  },
  description: {
    required: true,
    minLength: 50,
    maxLength: 2000,
    errorMessage: "Description must be at least 50 characters",
  },
  price: {
    required: true,
    min: 100, // minimum price in ₦
    max: 100000000,
    errorMessage: "Price must be greater than 100₦",
  },
  bulk_price_from: {
    required: false,
    min: 1,
    max: 10000,
  },
  bulk_price_per_piece: {
    required: false,
    min: 1,
    max: 100000000,
  },
  negotiation: {
    required: true,
    options: ["Yes", "No", "Not sure"],
  },
  category: {
    required: true,
  },
  subcategory: {
    required: true,
  },
  brand: {
    required: true,
  },
  model: {
    required: true,
  },
  condition: {
    required: true,
  },
  used_detail: {
    required: false,
  },
  ram: {
    required: false,
  },
  storage: {
    required: false,
  },
  color: {
    required: false,
  },
  sim: {
    required: false,
  },
  engine: {
    required: false,
  },
  mileage: {
    required: false,
    min: 0,
  },
  year: {
    required: false,
    min: 1900,
    max: new Date().getFullYear(),
  },
  fuel_type: {
    required: false,
  },
  transmission: {
    required: false,
  },
  bedrooms: {
    required: false,
    min: 0,
  },
  bathrooms: {
    required: false,
    min: 0,
  },
  size: {
    required: false,
  },
  furnished: {
    required: false,
  },
  features: {
    required: false,
  },
  exchange_possible: {
    required: false,
  },
  images: {
    required: true,
    max: 10,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    errorMessage: "You can upload up to 10 images (jpeg, png, webp)",
  },
  video_link: {
    required: false,
    maxLength: 200,
  },
  promoted: {
    required: false,
  },
  promo_plan: {
    required: false,
  },
};