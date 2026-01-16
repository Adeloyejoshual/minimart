// src/config/categoriesData.js

const categoriesData = {
  "Mobile Phones & Tablets": {
    subcategories: ["Mobile Phones", "Tablets", "Phone Accessories"],
    brands: {
      "Mobile Phones": [
        "Apple", "Samsung", "Tecno", "Itel", "Xiaomi", "Huawei", "Infinix", "Oppo", "Vivo", "Nokia", "Sony", "Realme", "Motorola", "Asus", "LG"
      ],
      Tablets: ["Apple", "Samsung", "Huawei", "Lenovo", "Microsoft", "Asus"]
    },
    models: {
      Apple: [
        // Latest
        "iPhone 17 Pro Max","iPhone 17 Pro","iPhone 17",
        "iPhone 16 Pro Max","iPhone 16 Pro","iPhone 16 Plus","iPhone 16",
        "iPhone 15 Pro Max","iPhone 15 Pro","iPhone 15 Plus","iPhone 15",
        "iPhone SE (2022)","iPhone SE (2020)",
        "iPhone 14 Pro Max","iPhone 14 Pro","iPhone 14 Plus","iPhone 14",
        // Older models
        "iPhone 13 Pro Max","iPhone 13 Pro","iPhone 13 Mini","iPhone 13",
        "iPhone 12 Pro Max","iPhone 12 Pro","iPhone 12 Mini","iPhone 12",
        "iPhone 11 Pro Max","iPhone 11 Pro","iPhone 11","iPhone XR",
        "iPhone XS Max","iPhone XS","iPhone X","iPhone 8 Plus","iPhone 8",
        "iPhone 7 Plus","iPhone 7","iPhone 6s Plus","iPhone 6s",
        "iPhone 6 Plus","iPhone 6","iPhone 5s","iPhone 5c","iPhone 5",
        "iPhone 4s","iPhone 4","iPhone 4 CDMA","iPhone 3GS","iPhone 3G"
      ],
      Samsung: [
        // Latest
        "Galaxy S23 Ultra","Galaxy S23+","Galaxy S23","Galaxy S22 Ultra","Galaxy S22+","Galaxy S22",
        "Galaxy S21 Ultra","Galaxy S21+","Galaxy S21",
        // Older
        "Galaxy Note 20","Galaxy Note 20 Ultra",
        "Galaxy A73","Galaxy A53","Galaxy A33",
        "Galaxy Z Fold 4","Galaxy Z Flip 4","Galaxy S20","Galaxy S10","Galaxy S9","Galaxy S8"
      ],
      Tecno: ["Camon 20","Camon 19","Spark 10","Spark 9","Pouvoir 4","Pouvoir 5","Camon 18","Spark 8"],
      Itel: ["Itel S23","Itel S21","Itel A56","Itel A48","Itel P36","Itel A25"],
      Xiaomi: ["Redmi Note 12","Redmi Note 11","Mi 12","Mi 11","Poco X5","Poco X4 Pro","Poco M5","Redmi 12C","Redmi 10","Mi 10","Mi 9"],
      Huawei: ["P50 Pro","P40","Mate 40 Pro","Mate 30","P30","Mate 20"],
      Infinix: ["Zero 5","Hot 20","Note 12","Note 11","Smart 6","Hot 10","Hot 9"],
      Oppo: ["Find X6 Pro","Reno 9","A77","A57","Reno 8","Reno 7","A54"],
      Vivo: ["Vivo X90","Vivo V27","Vivo Y33","Vivo Y22","Vivo Y21","Vivo X60"],
      Nokia: ["Nokia G21","Nokia X20","Nokia C31","Nokia 105","Nokia 3310","Nokia 6300"],
      Sony: ["Xperia 1 IV","Xperia 5 III","Xperia 10 IV","Xperia Z5","Xperia XZ"],
      Realme: ["GT 3","Narzo 60","C55","C35","Narzo 50","Realme 8","Realme 7"],
      Motorola: ["Edge 40","Moto G73","Moto G32","Moto E32","Moto G9","Moto G8"],
      Asus: ["Zenfone 9","ROG Phone 7","ROG Phone 6","Zenfone 8","Zenfone 7"],
      LG: ["LG Velvet","LG Wing","LG K62","LG G8","LG V50"]
    }
  },

  "Vehicles": {
    subcategories: ["Cars", "Motorcycles", "Trucks", "Buses", "Spare Parts"],
    brands: {
      Cars: ["Toyota","Honda","Ford","BMW","Mercedes","Nissan","Hyundai","Kia","Chevrolet","Audi","Volkswagen"],
      Motorcycles: ["Honda","Yamaha","Suzuki","KTM","Bajaj","Harley Davidson"],
      Trucks: ["Volvo","Mercedes","MAN","Scania","Isuzu"],
      Buses: ["Mercedes","Volvo","Iveco","MAN"],
      "Spare Parts": []
    },
    models: {
      Toyota: ["Corolla","Camry","Highlander","RAV4","Land Cruiser","Yaris","Prius","Fortuner","Hilux","Avalon","Supra"],
      Honda: ["Civic","Accord","CR-V","Pilot","Fit","City","Jazz","HR-V"],
      BMW: ["X5","X3","3 Series","5 Series","7 Series","M3","M5","Z4"],
      Ford: ["F-150","Escape","Explorer","Mustang","Focus","Ranger","Edge"],
      Mercedes: ["C-Class","E-Class","GLA","GLE","S-Class","Sprinter","A-Class","B-Class"],
      Nissan: ["Altima","Maxima","Rogue","Pathfinder","Navara","Leaf","370Z"],
      Hyundai: ["Elantra","Tucson","Santa Fe","Accent","Kona","i30"],
      Kia: ["Sportage","Sorento","Rio","Cerato","Stinger","K5"],
      Chevrolet: ["Silverado","Camaro","Tahoe","Traverse","Impala","Equinox"],
      Audi: ["A3","A4","A6","Q5","Q7","Q8","Q3"]
    }
  },

  // Other categories can remain as before
  "Property": { subcategories: ["Houses","Apartments & Flats","Land","Commercial Property","Vacation Rentals"], brands: {}, models: {} },
  "Electronics": { subcategories: ["Laptops & Computers","TV & Audio","Cameras","Gaming","Computer Accessories","Networking","Software"], brands: {}, models: {} },
  "Home, Furniture & Appliances": { subcategories: ["Furniture","Kitchen Appliances","Lighting","Decor","Cleaning Supplies"], brands: {}, models: {} },
  "Fashion": { subcategories: ["Clothing","Shoes","Accessories","Bags","Jewelry"], brands: {}, models: {} },
  "Beauty & Personal Care": { subcategories: ["Cosmetics","Hair Care","Skincare","Fragrances"], brands: {}, models: {} },
  "Services": { subcategories: ["Tutoring","Transportation","Events","Health & Wellness"], brands: {}, models: {} },
  "Repair & Construction": { subcategories: ["Plumbing","Electrical","Painting","Renovation"], brands: {}, models: {} },
  "Commercial Equipment & Tools": { subcategories: ["Machinery","Industrial Tools","Office Equipment"], brands: {}, models: {} },
  "Leisure & Activities": { subcategories: ["Sports Equipment","Gym & Fitness","Outdoor Activities","Hobbies"], brands: {}, models: {} },
  "Babies & Kids": { subcategories: ["Toys","Clothing","Strollers","Baby Care"], brands: {}, models: {} },
  "Food, Agriculture & Farming": { subcategories: ["Produce","Livestock","Farm Equipment"], brands: {}, models: {} },
  "Animals & Pets": { subcategories: ["Pets","Pet Food","Pet Accessories"], brands: {}, models: {} },
  "Jobs": { subcategories: ["Full-time","Part-time","Freelance"], brands: {}, models: {} },
  "Seeking Work - CVs": { subcategories: ["CVs","Portfolios"], brands: {}, models: {} }
};

export default categoriesData;