// src/config/categoryRules.js

export const categoryRules = {
  default: {
    minTitle: 15,
    minDescription: 30,
    minImages: 0, // ✅ NO MIN IMAGE
    maxImages: 6,
    maxImageSizeMB: 4,
  },

  "Phones & Tablets": {
    minTitle: 20,
    minDescription: 40,
  },

  "Vehicles": {
    minTitle: 25,
    minDescription: 60,
  },

  "Property": {
    minTitle: 25,
    minDescription: 80,
  },

  "Jobs": {
    minTitle: 10,
    minDescription: 20,
  }
};