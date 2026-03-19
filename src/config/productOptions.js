// src/config/productOptions.js

const productOptions = {
  "Phones & Tablets": {
    subcategories: {
      Smartphones: {
        Apple: ["iPhone 11", "iPhone 12", "iPhone 13"],
        Samsung: ["Galaxy S21", "Galaxy S22"],
        Tecno: ["Camon 20", "Spark 10"],
        Infinix: ["Hot 30", "Note 12"],
        features: ["4G", "5G", "Dual SIM", "Face ID"],
      },
      "Feature Phones": {
        Nokia: ["3310", "105"],
        Itel: ["It2160"],
        features: ["FM Radio", "Long Battery"],
      },
      Tablets: {
        Apple: ["iPad Pro", "iPad Air"],
        Samsung: ["Galaxy Tab S8"],
        features: ["Stylus Support", "Large Screen"],
      },
    },
  },

  Vehicles: {
    subcategories: {
      Cars: {
        Toyota: ["Camry", "Corolla"],
        Honda: ["Civic", "Accord"],
        features: ["AC", "Airbags", "Navigation"],
      },
      Motorcycles: {
        Yamaha: ["R1", "R6"],
        Honda: ["CBR"],
        features: ["ABS", "Electric Start"],
      },
    },
  },

  Electronics: {
    subcategories: {
      TVs: {
        LG: ["OLED", "NanoCell"],
        Samsung: ["QLED"],
        features: ["Smart TV", "4K", "HDR"],
      },
      Audio: {
        Sony: ["WH-1000XM4"],
        JBL: ["Flip 5"],
        features: ["Bluetooth", "Noise Cancelling"],
      },
    },
  },

  Fashion: {
    subcategories: {
      Clothing: {
        Nike: ["Shirt", "Short"],
        Zara: ["Jacket"],
        features: ["Cotton", "Slim Fit"],
      },
      Shoes: {
        Nike: ["Air Force 1"],
        Adidas: ["Ultraboost"],
        features: ["Lightweight", "Durable"],
      },
    },
  },

  "Home, Furniture & Appliances": {
    subcategories: {
      Furniture: {
        Generic: ["Chair", "Table", "Sofa"],
        features: ["Wood", "Modern Design"],
      },
      Appliances: {
        LG: ["Fridge", "Washing Machine"],
        Samsung: ["Microwave"],
        features: ["Energy Saving", "Smart"],
      },
    },
  },

  Property: {
    subcategories: {
      "For Sale": {
        features: ["3 Bedrooms", "Parking", "Security"],
      },
      "For Rent": {
        features: ["Furnished", "Water Supply"],
      },
    },
  },

  Jobs: {
    subcategories: {
      IT: {
        features: ["Remote", "Full-time"],
      },
      Marketing: {
        features: ["Digital Marketing"],
      },
    },
  },

  Services: {
    subcategories: {
      Repair: {
        features: ["Fast Service", "Affordable"],
      },
      Cleaning: {
        features: ["Home Service"],
      },
    },
  },
};

export default productOptions;