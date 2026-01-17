// /config/categoryRules.js

const categoryRules = {
  /* ================= TV & DVD Equipment ================= */
  "TV & DVD Equipment": {
    minTitle: 10,
    maxTitle: 70,
    minImages: 2,
    maxImages: 20,
    requireBrand: true,
    requireModel: true,
    requireCondition: true,
    requireType: true,
    requireLocation: true,
    maxDescription: 850,
    freeAdsLimit: 1
  },

  /* ================= Phones ================= */
  Phones: {
    minTitle: 10,
    maxTitle: 70,
    minImages: 1,
    maxImages: 10,
    requireBrand: true,
    requireModel: true,
    requireLocation: true,
    maxDescription: 600,
    freeAdsLimit: 2
  },

  /* ================= Default rules ================= */
  Default: {
    minTitle: 5,
    maxTitle: 70,
    minImages: 1,
    maxImages: 10,
    requireLocation: true,
    maxDescription: 500,
    freeAdsLimit: 3
  }
};

export default categoryRules;