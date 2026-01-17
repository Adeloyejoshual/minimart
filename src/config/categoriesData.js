// src/config/categoriesData.js

const categoriesData = {
  "Mobile Phones & Tablets": {
    subcategories: ["Mobile Phones", "Tablets", "Phone Accessories"],
    brands: {
      "Mobile Phones": [
        "Apple","Samsung","Tecno","Itel","Xiaomi","Huawei","Infinix",
        "Oppo","Vivo","Nokia","Sony","Realme","Motorola","Asus","LG","BlackBerry","HTC"
      ],
      Tablets: ["Apple","Samsung","Huawei","Lenovo","Microsoft","Asus","Amazon"]
    },
    models: {
      Apple: [
        "iPhone 17 Pro Max","iPhone 17 Pro","iPhone 17","iPhone 16 Pro Max","iPhone 16 Pro","iPhone 16 Plus",
        "iPhone 15 Pro Max","iPhone 15 Pro","iPhone 15 Plus","iPhone 15"
      ],
      Samsung: ["Galaxy S23 Ultra","Galaxy S23+","Galaxy S23","Galaxy S22 Ultra","Galaxy S22+","Galaxy S22"],
      Tecno: ["Camon 20","Camon 19","Camon 18","Spark 10","Spark 9"],
      Itel: ["S23","S21","A56","A48","A25"],
      Xiaomi: ["Redmi Note 12","Redmi Note 11","Redmi 10","Poco X5","Mi 12"],
      Huawei: ["P50 Pro","P40 Pro","Mate 40 Pro","Mate 30 Pro"],
      Infinix: ["Zero 5","Hot 20","Hot 10","Note 12","Note 11"],
      Oppo: ["Find X6 Pro","Reno 9","Reno 8","Reno 7"],
      Vivo: ["X90","V27","Y33"],
      Nokia: ["G21","X20","C31"],
      Sony: ["Xperia 1 IV","Xperia 5 III"],
      Realme: ["GT 3","Narzo 60"],
      Motorola: ["Edge 40","G73"],
      Asus: ["ROG Phone 7","Zenfone 9"],
      LG: ["Velvet","Wing"],
      BlackBerry: ["Bold","Curve"],
      HTC: ["One M9","One M8"]
    },
    options: {
      storage: ["16GB","32GB","64GB","128GB","256GB","512GB","1TB"],
      colors: ["Black","White","Gold","Silver","Blue","Red","Green","Purple","Gray","Pink"],
      simTypes: ["Single SIM","Dual SIM","eSIM"],
      condition: ["Brand New","Used","Refurbished"],
      features: ["5G","4G LTE","Fingerprint Sensor","Face ID","Wireless Charging","Fast Charging","Water Resistant"]
    }
  },

  // Other categories simplified for brevity
  Vehicles: { subcategories: ["Cars","Motorcycles"], brands: {}, models: {}, options: {} },
  Electronics: { subcategories: ["Laptops","TVs"], brands: {}, models: {}, options: {} },
  Property: { subcategories: ["Houses","Land"], brands: {}, models: {}, options: {} }
};

export default categoriesData;