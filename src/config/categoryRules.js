// src/config/categoryRules.js
export const categoryRules = {
  electronics: {
    phones: {
      condition: true,
      dynamicFields: ['ram', 'storage', 'color'],
      simSupport: true,
      features: true,
      maxImages: 8
    },
    laptops: {
      condition: true,
      dynamicFields: ['ram', 'storage', 'color'],
      features: true,
      maxImages: 6
    },
    tablets: {
      condition: true,
      dynamicFields: ['ram', 'storage', 'color'],
      features: true,
      maxImages: 6
    },
    cameras: {
      condition: true,
      dynamicFields: ['color'],
      features: true,
      maxImages: 10
    },
    gaming_consoles: {
      condition: true,
      features: true,
      maxImages: 6
    },
    accessories: {
      condition: true,
      dynamicFields: ['color'],
      maxImages: 6
    }
  },
  vehicles: {
    cars: {
      condition: true,
      dynamicFields: ['year', 'engine', 'fuelType', 'transmission', 'color'],
      features: true,
      maxImages: 12
    },
    motorcycles: {
      condition: true,
      dynamicFields: ['year', 'engine', 'color'],
      features: true,
      maxImages: 8
    },
    bicycles: {
      condition: true,
      dynamicFields: ['color'],
      features: true,
      maxImages: 6
    }
  },
  fashion: {
    mens_clothing: {
      condition: true,
      dynamicFields: ['color'],
      maxImages: 6
    },
    womens_clothing: {
      condition: true,
      dynamicFields: ['color'],
      maxImages: 6
    },
    shoes: {
      condition: true,
      dynamicFields: ['color'],
      maxImages: 6
    },
    bags: {
      condition: true,
      dynamicFields: ['color'],
      maxImages: 6
    },
    watches: {
      condition: true,
      dynamicFields: ['color'],
      maxImages: 8
    }
  },
  home_living: {
    furniture: {
      condition: true,
      dynamicFields: ['color'],
      features: true,
      maxImages: 8
    },
    appliances: {
      condition: true,
      dynamicFields: ['color'],
      features: true,
      maxImages: 6
    },
    kitchenware: {
      condition: true,
      dynamicFields: ['color'],
      maxImages: 6
    },
    decor: {
      condition: true,
      dynamicFields: ['color'],
      maxImages: 8
    }
  },
  real_estate: {
    apartments: {
      features: true,
      maxImages: 15
    },
    houses: {
      features: true,
      maxImages: 15
    },
    land: {
      features: true,
      maxImages: 10
    }
  },
  services: {
    beauty: {
      maxImages: 6
    },
    repair: {
      maxImages: 6
    },
    lessons: {
      maxImages: 4
    }
  }
};