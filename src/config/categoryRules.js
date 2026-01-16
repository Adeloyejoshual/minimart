// src/config/categoryRules.js
export const categoryRules = {
  "TV & DVD Equipment": {
    minTitle: 10,
    maxTitle: 70,
    minImages: 2,
    maxImages: 20,
    requireBrand: true,
    requireModel: true,
    maxDescription: 850,
    freeAdsLimit: 1,
  },

  Phones: {
    minTitle: 10,
    maxTitle: 70,
    minImages: 1,
    maxImages: 10,
    requireBrand: true,
    requireModel: true,
    maxDescription: 850,
    freeAdsLimit: 2,
  },
};