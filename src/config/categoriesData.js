// src/config/categoriesData.js

const categoriesData = {
  /* ================= MOBILE PHONES & TABLETS ================= */
  "Mobile Phones & Tablets": {
    subcategories: {
      "Mobile Phones": {},
      "Tablets": {},
      "Phone Accessories": {}
    },
    brands: {
      "Mobile Phones": [
        "Apple","Samsung","Tecno","Itel","Xiaomi","Huawei","Infinix",
        "Oppo","Vivo","Nokia","Sony","Realme","Motorola","Asus","LG","BlackBerry","HTC"
      ],
      Tablets: ["Apple","Samsung","Huawei","Lenovo","Microsoft","Asus","Amazon"]
    },
    models: {
      Apple: [
        "iPhone 17 Pro Max","iPhone 17 Pro","iPhone 17","iPhone 16 Pro Max","iPhone 16 Pro","iPhone 16 Plus","iPhone 16",
        "iPhone 15 Pro Max","iPhone 15 Pro","iPhone 15 Plus","iPhone 15",
        "iPhone SE (2022)","iPhone SE (2020)",
        "iPhone 14 Pro Max","iPhone 14 Pro","iPhone 14 Plus","iPhone 14",
        "iPhone 13 Pro Max","iPhone 13 Pro","iPhone 13 Mini","iPhone 13",
        "iPhone 12 Pro Max","iPhone 12 Pro","iPhone 12 Mini","iPhone 12",
        "iPhone 11 Pro Max","iPhone 11 Pro","iPhone 11","iPhone XR",
        "iPhone XS Max","iPhone XS","iPhone X","iPhone 8 Plus","iPhone 8",
        "iPhone 7 Plus","iPhone 7","iPhone 6s Plus","iPhone 6s",
        "iPhone 6 Plus","iPhone 6","iPhone 5s","iPhone 5c","iPhone 5",
        "iPhone 4s","iPhone 4","iPhone 4 CDMA","iPhone 3GS","iPhone 3G"
      ],
      Samsung: [
        "Galaxy S23 Ultra","Galaxy S23+","Galaxy S23","Galaxy S22 Ultra","Galaxy S22+","Galaxy S22",
        "Galaxy S21 Ultra","Galaxy S21+","Galaxy S21","Galaxy Note 20","Galaxy Note 20 Ultra",
        "Galaxy Note 10","Galaxy A73","Galaxy A53","Galaxy A33","Galaxy A22","Galaxy A12",
        "Galaxy Z Fold 4","Galaxy Z Flip 4","Galaxy S20","Galaxy S10","Galaxy S9","Galaxy S8"
      ],
      Tecno: ["Camon 20","Camon 19","Camon 18","Spark 10","Spark 9","Spark 8","Pouvoir 4","Pouvoir 5"],
      Itel: ["S23","S21","A56","A48","A25","A16"],
      Xiaomi: ["Redmi Note 12","Redmi Note 11","Redmi 10","Redmi 9","Mi 12","Mi 11","Mi 10","Poco X5","Poco X3"],
      Huawei: ["P50 Pro","P40 Pro","P30 Pro","P20","Mate 40 Pro","Mate 30 Pro","Mate 20 Pro"],
      Infinix: ["Zero 5","Zero 4","Hot 20","Hot 10","Note 12","Note 11","Smart 6"],
      Oppo: ["Find X6 Pro","Reno 9","Reno 8","Reno 7","A77","A57","A54"],
      Vivo: ["X90","V27","Y33","Y22","Y21","Y20"],
      Nokia: ["G21","X20","C31","105","3310","6300"],
      Sony: ["Xperia 1 IV","Xperia 5 III","Xperia 10 IV","Xperia Z5","Xperia XZ"],
      Realme: ["GT 3","Narzo 60","Narzo 50","C55","C35"],
      Motorola: ["Edge 40","G73","G32","G9","G8"],
      Asus: ["ROG Phone 7","ROG Phone 6","Zenfone 9","Zenfone 8"],
      LG: ["Velvet","Wing","G8","V50"],
      BlackBerry: ["Bold","Curve","Passport","Key2"],
      HTC: ["One M9","One M8","Desire 820"]
    },
    options: {
      storage: ["16GB","32GB","64GB","128GB","256GB","512GB","1TB"],
      colors: ["Black","White","Gold","Silver","Blue","Red","Green","Purple","Gray","Pink"],
      simTypes: ["Single SIM","Dual SIM","eSIM"],
      features: ["5G","4G LTE","Fingerprint Sensor","Face ID","Wireless Charging","Fast Charging","Water Resistant"]
    }
  },

  /* ================= VEHICLES ================= */
  "Vehicles": {
    subcategories: {
      Cars: {},
      Motorcycles: {},
      Trucks: {},
      Buses: {},
      "Spare Parts": {}
    },
    brands: {
      Cars: ["Toyota","Honda","Ford","BMW","Mercedes","Nissan","Hyundai","Kia","Chevrolet","Audi","Volkswagen","Lexus","Peugeot"],
      Motorcycles: ["Honda","Yamaha","Suzuki","KTM","Bajaj","TVS","Harley Davidson"],
      Trucks: ["Volvo","Mercedes","MAN","Scania","Isuzu","Howo"],
      Buses: ["Mercedes","Volvo","Iveco","MAN","Toyota"],
      "Spare Parts": ["Bosch","Denso","ACDelco","Valeo","NGK"]
    },
    models: {
      Toyota: ["Corolla","Camry","RAV4","Highlander","Hilux","Prado","Venza","Matrix"],
      Honda: ["Civic","Accord","CR-V","Pilot","City"],
      BMW: ["X5","X3","3 Series","5 Series","7 Series"],
      Mercedes: ["C-Class","E-Class","GLE","GLK","S-Class","Sprinter"],
      Ford: ["F-150","Ranger","Explorer","Escape","Mustang"],
      Nissan: ["Altima","Pathfinder","Navara","X-Trail","Sentra"],
      Hyundai: ["Elantra","Tucson","Santa Fe","Accent"],
      Kia: ["Sportage","Sorento","Rio","Cerato"],
      Audi: ["A4","A6","Q5","Q7"]
    },
    options: {
      fuelTypes: ["Petrol","Diesel","Electric","Hybrid","CNG"],
      transmissions: ["Manual","Automatic","CVT","Dual-Clutch"],
      features: ["Air Conditioning","GPS","Sunroof","Leather Seats","Parking Sensors","Bluetooth"]
    }
  },

  /* ================= ELECTRONICS ================= */
  "Electronics": {
    subcategories: {
      "Laptops & Computers": {},
      "TV & Audio": {},
      Gaming: {},
      Cameras: {},
      Networking: {},
      Headphones: {},
      Monitors: {},
      Printers: {}
    },
    brands: {
      "Laptops & Computers": ["HP","Dell","Lenovo","Apple","Asus","Acer","MSI","Toshiba","Microsoft"],
      "TV & Audio": ["Samsung","LG","Sony","Hisense","TCL","Panasonic"],
      Gaming: ["Sony","Microsoft","Nintendo"],
      Cameras: ["Canon","Nikon","Sony","Fujifilm","Panasonic"],
      Networking: ["TP-Link","MikroTik","Ubiquiti","Netgear"],
      Headphones: ["Sony","Bose","Sennheiser","JBL","Beats"],
      Monitors: ["Dell","LG","Samsung","Asus","Acer"],
      Printers: ["HP","Canon","Epson","Brother"]
    },
    models: {
      HP: ["Pavilion","EliteBook","ProBook","Omen","Compaq"],
      Dell: ["Inspiron","XPS","Latitude","Vostro"],
      Lenovo: ["ThinkPad","IdeaPad","Yoga"],
      Apple: ["MacBook Air","MacBook Pro","iMac","Mac Mini"],
      Samsung: ["Smart TV 32\"","Smart TV 55\"","Smart TV 65\""],
      Sony: ["PlayStation 5","PlayStation 4","PlayStation 3"],
      Microsoft: ["Xbox Series X","Xbox Series S","Xbox One"],
      Canon: ["EOS 90D","EOS 80D","EOS R5"]
    },
    options: {
      storage: ["128GB","256GB","512GB","1TB"],
      colors: ["Black","White","Silver","Gray","Blue"],
      features: ["4K","Full HD","Bluetooth","Wi-Fi","Touchscreen","HDR"]
    }
  },

  /* ================= PROPERTY ================= */
  "Property": {
    subcategories: {
      Houses: {},
      "Apartments & Flats": {},
      Land: {},
      "Commercial Property": {},
      "Vacation Rentals": {}
    },
    brands: {},
    models: {},
    options: {
      size: ["50 sqm","100 sqm","150 sqm","200 sqm","500 sqm","1000 sqm"],
      rooms: ["1","2","3","4","5","6+"],
      bathrooms: ["1","2","3","4+"],
      features: ["Swimming Pool","Garage","Balcony","Furnished","Security","Garden"]
    }
  },

  /* ================= HOME, FURNITURE & APPLIANCES ================= */
  "Home, Furniture & Appliances": {
    subcategories: {
      Furniture: {},
      "Kitchen Appliances": {},
      "Home Appliances": {},
      Lighting: {},
      Decor: {},
      "Cleaning Supplies": {}
    },
    brands: {
      Furniture: ["Ikea","Ashley","Home Centre","Lifemate"],
      "Kitchen Appliances": ["LG","Samsung","Hisense","Scanfrost","Haier Thermocool"],
      "Home Appliances": ["LG","Samsung","Panasonic","Whirlpool","Bosch"],
      Lighting: ["Philips","Osram","GE"],
      Decor: ["Ikea","Ashley","Home Centre"],
      "Cleaning Supplies": ["Vileda","Bissell","Eureka"]
    },
    models: {},
    options: {}
  },

  /* ================= FASHION & BEAUTY ================= */
  "Fashion": {
    subcategories: {
      Clothing: {},
      Shoes: {},
      Bags: {},
      Accessories: {},
      Jewelry: {}
    },
    brands: {
      Clothing: ["Nike","Adidas","Gucci","Zara","H&M","Louis Vuitton"],
      Shoes: ["Nike","Adidas","Puma","Reebok","Balenciaga"],
      Bags: ["Louis Vuitton","Gucci","Prada","Chanel"]
    },
    models: {},
    options: {}
  },

  "Beauty & Personal Care": {
    subcategories: {
      Cosmetics: {},
      "Hair Care": {},
      Skincare: {},
      Fragrances: {}
    },
    brands: {
      Cosmetics: ["MAC","Maybelline","Zaron","Fenty Beauty"],
      Fragrances: ["Dior","Chanel","Versace","Lattafa","Armaf"]
    },
    models: {},
    options: {}
  },

  /* ================= BABIES & KIDS ================= */
  "Babies & Kids": {
    subcategories: {
      Toys: {},
      Clothing: {},
      Strollers: {},
      "Baby Care": {}
    },
    brands: {
      "Baby Care": ["Pampers","Huggies","Cussons","Johnson & Johnson"],
      Strollers: ["Graco","Chicco"],
      Toys: ["Lego","Fisher-Price","Mattel","Hasbro"]
    },
    models: {},
    options: {
      age: ["0-1","1-3","3-5","5-7","7-12","12+"],
      size: ["Small","Medium","Large"]
    }
  },

  /* ================= AGRICULTURE ================= */
  "Food, Agriculture & Farming": {
    subcategories: {
      Produce: {},
      Livestock: {},
      "Farm Equipment": {}
    },
    brands: {
      "Farm Equipment": ["John Deere","Massey Ferguson","Kubota","New Holland"]
    },
    models: {},
    options: {
      livestock: ["Cattle","Goats","Sheep","Chickens","Pigs"],
      produce: ["Fruits","Vegetables","Grains"]
    }
  },

  /* ================= PETS ================= */
  "Animals & Pets": {
    subcategories: {
      Pets: {},
      "Pet Food": {},
      "Pet Accessories": {}
    },
    brands: {
      "Pet Food": ["Pedigree","Royal Canin","Purina"],
      "Pet Accessories": ["Collars","Leashes","Toys"]
    },
    models: {},
    options: {
      size: ["Small","Medium","Large"],
      age: ["Puppy/Kitten","Adult","Senior"]
    }
  },

  /* ================= SERVICES & JOBS ================= */
  "Services": {
    subcategories: {
      Tutoring: {},
      Transportation: {},
      Events: {},
      "Health & Wellness": {},
      "Professional Services": {}
    },
    brands: {},
    models: {},
    options: {}
  },
  "Repair & Construction": {
    subcategories: {
      Plumbing: {},
      Electrical: {},
      Painting: {},
      Renovation: {},
      Carpentry: {},
      Masonry: {}
    },
    brands: {},
    models: {},
    options: {}
  },
  "Commercial Equipment & Tools": {
    subcategories: {
      Machinery: {},
      "Industrial Tools": {},
      "Office Equipment": {},
      "Construction Tools": {}
    },
    brands: {},
    models: {},
    options: {}
  },
  "Leisure & Activities": {
    subcategories: {
      "Sports Equipment": {},
      "Gym & Fitness": {},
      "Outdoor Activities": {},
      Hobbies: {},
      "Books & Stationery": {}
    },
    brands: {},
    models: {},
    options: {}
  },

  "Jobs": {
    subcategories: {
      "Full-time": {},
      "Part-time": {},
      Freelance: {}
    },
    brands: {},
    models: {},
    options: {}
  },
  "Seeking Work - CVs": {
    subcategories: {
      CVs: {},
      Portfolios: {}
    },
    brands: {},
    models: {},
    options: {}
  }
};

export default categoriesData;