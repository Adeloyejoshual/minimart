// /config/categoryRules.js

const categoryRules = {
  /* ================= Mobile Phones & Tablets ================= */
  "Mobile Phones & Tablets": {
    minTitle: 15,
    maxTitle: 70,
    minImages: 1,
    maxImages: 10,
    requireBrand: true,
    requireModel: true,
    requireLocation: true,
    maxDescription: 600,
    freeAdsLimit: 2
  },

  /* ================= Electronics ================= */
  Electronics: {
    minTitle: 15,
    maxTitle: 70,
    minImages: 1,
    maxImages: 15,
    requireBrand: true,
    requireModel: false,
    requireLocation: true,
    maxDescription: 700,
    freeAdsLimit: 2
  },

  /* ================= Vehicles ================= */
  Vehicles: {
    minTitle: 15,
    maxTitle: 70,
    minImages: 2,
    maxImages: 20,
    requireBrand: true,
    requireModel: true,
    requireCondition: true,
    requireLocation: true,
    maxDescription: 800,
    freeAdsLimit: 1
  },

  /* ================= Property ================= */
  Property: {
    minTitle: 15,
    maxTitle: 70,
    minImages: 2,
    maxImages: 20,
    requireLocation: true,
    requireType: true,
    maxDescription: 1000,
    freeAdsLimit: 1
  },

  /* ================= Home, Furniture & Appliances ================= */
  "Home, Furniture & Appliances": {
    minTitle: 15,
    maxTitle: 70,
    minImages: 1,
    maxImages: 15,
    requireBrand: false,
    requireType: true,
    requireLocation: true,
    maxDescription: 700,
    freeAdsLimit: 3
  },

  /* ================= Fashion ================= */
  Fashion: {
    minTitle: 15,
    maxTitle: 70,
    minImages: 1,
    maxImages: 10,
    requireBrand: true,
    requireType: true,
    requireLocation: true,
    maxDescription: 500,
    freeAdsLimit: 3
  },

  /* ================= Beauty & Personal Care ================= */
  "Beauty & Personal Care": {
    minTitle: 15,
    maxTitle: 70,
    minImages: 1,
    maxImages: 10,
    requireBrand: true,
    requireType: true,
    requireLocation: true,
    maxDescription: 500,
    freeAdsLimit: 3
  },

  /* ================= Services ================= */
  Services: {
    minTitle: 15,
    maxTitle: 70,
    minImages: 0,
    maxImages: 5,
    requireLocation: true,
    requireType: true,
    maxDescription: 600,
    freeAdsLimit: 3
  },

  /* ================= Repair & Construction ================= */
  "Repair & Construction": {
    minTitle: 15,
    maxTitle: 70,
    minImages: 0,
    maxImages: 10,
    requireLocation: true,
    requireType: true,
    maxDescription: 600,
    freeAdsLimit: 3
  },

  /* ================= Commercial Equipment & Tools ================= */
  "Commercial Equipment & Tools": {
    minTitle: 15,
    maxTitle: 70,
    minImages: 1,
    maxImages: 15,
    requireBrand: false,
    requireType: true,
    requireLocation: true,
    maxDescription: 700,
    freeAdsLimit: 2
  },

  /* ================= Leisure & Activities ================= */
  "Leisure & Activities": {
    minTitle: 15,
    maxTitle: 70,
    minImages: 1,
    maxImages: 10,
    requireType: true,
    requireLocation: true,
    maxDescription: 500,
    freeAdsLimit: 3
  },

  /* ================= Babies & Kids ================= */
  "Babies & Kids": {
    minTitle: 5,
    maxTitle: 70,
    minImages: 1,
    maxImages: 10,
    requireType: true,
    requireLocation: true,
    maxDescription: 500,
    freeAdsLimit: 3
  },

  /* ================= Food, Agriculture & Farming ================= */
  "Food, Agriculture & Farming": {
    minTitle: 15,
    maxTitle: 70,
    minImages: 1,
    maxImages: 10,
    requireType: true,
    requireLocation: true,
    maxDescription: 500,
    freeAdsLimit: 3
  },

  /* ================= Animals & Pets ================= */
  "Animals & Pets": {
    minTitle: 15,
    maxTitle: 70,
    minImages: 1,
    maxImages: 10,
    requireType: true,
    requireLocation: true,
    maxDescription: 500,
    freeAdsLimit: 3
  },

  /* ================= Jobs ================= */
  Jobs: {
    minTitle: 15,
    maxTitle: 70,
    minImages: 0,
    maxImages: 5,
    requireType: true,
    requireLocation: true,
    maxDescription: 600,
    freeAdsLimit: 3
  },

  /* ================= Seeking Work - CVs ================= */
  "Seeking Work - CVs": {
    minTitle: 15,
    maxTitle: 70,
    minImages: 0,
    maxImages: 5,
    requireType: true,
    requireLocation: true,
    maxDescription: 600,
    freeAdsLimit: 3
  },

  /* ================= Default rules ================= */
  Default: {
    minTitle: 15,
    maxTitle: 70,
    minImages: 1,
    maxImages: 10,
    requireLocation: true,
    maxDescription: 500,
    freeAdsLimit: 3
  }
};

export default categoryRules;