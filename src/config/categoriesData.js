// src/config/categoriesData.js
import phoneModels from "./phoneModels";

const categoriesData = {
  "Mobile Phones & Tablets": {
    subcategories: ["Smartphones","Feature Phones","Tablets","Phone Accessories"],
    brands: {
      Smartphones: Object.keys(phoneModels.Smartphones),
      "Feature Phones": Object.keys(phoneModels["Feature Phones"]),
      Tablets: Object.keys(phoneModels.Tablets),
      "Phone Accessories": Object.keys(phoneModels.Accessories)
    },
    models: {
      ...phoneModels.Smartphones,
      ...phoneModels["Feature Phones"],
      ...phoneModels.Tablets,
      ...phoneModels.Accessories
    },
    options: {
      storage: ["16GB","32GB","64GB","128GB","256GB","512GB","1TB"],
      colors: ["Black","White","Gold","Silver","Blue","Red","Green","Purple","Gray","Pink","Other"],
      simTypes: ["Single SIM","Dual SIM","eSIM","WiFi Only","WiFi + SIM"],
      condition: ["Brand New","Used","Refurbished"],
      features: [
        "5G","4G LTE","Fingerprint Sensor","Face ID",
        "Wireless Charging","Fast Charging","Water Resistant",
        "NFC","Wireless","Noise Cancelling","Stylus Support"
      ]
    }
  },

  Vehicles: {
    subcategories: ["Cars","Motorcycles","Trucks","Buses","Spare Parts"],
    brands: {
      Cars: ["Toyota","Honda","Ford","BMW","Mercedes","Hyundai","Kia","Nissan"],
      Motorcycles: ["Honda","Yamaha","Suzuki","KTM","Bajaj"],
      Trucks: ["Volvo","Mercedes","MAN","Scania"],
      Buses: ["Mercedes","Volvo","Scania","Iveco"],
      "Spare Parts": ["Bosch","Denso","ACDelco","Valeo"]
    },
    models: {},
    options: {
      fuelTypes: ["Petrol","Diesel","Electric","Hybrid"],
      transmissions: ["Manual","Automatic","CVT"],
      features: ["Air Conditioning","GPS","Sunroof","Leather Seats","Bluetooth","Parking Sensors"]
    }
  },

  Electronics: {
    subcategories: ["Laptops & Computers","TVs & DVD","Gaming Consoles","Cameras & Photo"],
    brands: {},
    models: {},
    options: {}
  },

  Property: {
    subcategories: ["Houses","Apartments & Flats","Land","Commercial Property","Vacation Rentals"],
    brands: {},
    models: {},
    options: {}
  },

  "Home, Furniture & Appliances": {
    subcategories: ["Furniture","Kitchen Appliances","Lighting","Decor","Cleaning Supplies"],
    brands: {},
    models: {},
    options: {}
  },

  Fashion: {
    subcategories: ["Clothing","Shoes","Accessories","Bags","Jewelry"],
    brands: {},
    models: {},
    options: {}
  },

  "Beauty & Personal Care": {
    subcategories: ["Cosmetics","Hair Care","Skincare","Fragrances"],
    brands: {},
    models: {},
    options: {}
  }
};

export default categoriesData;