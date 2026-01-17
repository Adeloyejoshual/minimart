// /config/productOptions.js

const productOptions = {
  "Mobile Phones & Tablets": {
    subcategories: {
      "Mobile Phones": {
        storageOptions: ["16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"],
        colors: ["Black", "White", "Gray", "Gold", "Blue", "Red", "Green", "Purple"],
        simTypes: ["Nano-SIM", "eSIM", "Dual SIM"],
        features: [
          "Bluetooth 5.3",
          "IP68 dust/water resistant",
          "Wireless Charging",
          "Fingerprint Sensor",
          "Face ID",
          "5G Connectivity",
          "Fast Charging",
          "OLED/AMOLED Display",
          "High Refresh Rate Display",
          "Stereo Speakers",
          "Waterproof Design"
        ],
        brands: [
          "Apple", "Samsung", "Huawei", "Xiaomi", "Infinix", "Tecno", "Itel", "Oppo", "Vivo", "Motorola"
        ]
      },
      "Tablets": {
        storageOptions: ["32 GB", "64 GB", "128 GB", "256 GB", "512 GB"],
        colors: ["Black", "White", "Silver", "Gold", "Blue"],
        simTypes: ["Wi-Fi only", "Nano-SIM", "eSIM", "Cellular + Wi-Fi"],
        features: [
          "Stylus Support",
          "Face ID",
          "Fingerprint Sensor",
          "4G/5G Connectivity",
          "High-Resolution Display",
          "Long Battery Life",
          "Lightweight Design"
        ],
        brands: ["Apple", "Samsung", "Huawei", "Lenovo", "Microsoft", "Xiaomi"]
      },
      "Phone Accessories": {
        types: ["Charger", "Case", "Screen Protector", "Earphones", "Power Bank", "Wireless Charger", "Cables"],
        colors: ["Black", "White", "Red", "Blue", "Transparent"],
        features: ["Fast Charging", "Waterproof", "Shockproof", "Wireless", "Durable"]
      }
    }
  },

  Vehicles: {
    subcategories: {
      Cars: {
        fuelTypes: ["Petrol", "Diesel", "Electric", "Hybrid"],
        colors: ["Black", "White", "Silver", "Red", "Blue", "Gray", "Green", "Brown"],
        transmission: ["Manual", "Automatic", "Semi-Automatic"],
        features: [
          "Air Conditioning",
          "Power Steering",
          "Anti-lock Brakes (ABS)",
          "Sunroof",
          "GPS Navigation",
          "Bluetooth Connectivity",
          "Parking Sensors",
          "Heated Seats",
          "Cruise Control",
          "Lane Assist",
          "Airbags"
        ],
        brands: ["Toyota", "Honda", "BMW", "Mercedes", "Audi", "Ford", "Volkswagen", "Nissan", "Lexus", "Tesla"]
      },
      Motorcycles: {
        fuelTypes: ["Petrol", "Electric"],
        colors: ["Black", "Red", "Blue", "White", "Yellow"],
        transmission: ["Manual", "Automatic"],
        features: ["ABS Brakes", "LED Headlights", "Disc Brakes", "Storage Compartment", "Sport Design"],
        brands: ["Yamaha", "Honda", "Suzuki", "KTM", "BMW", "Ducati"]
      },
      Trucks: {
        fuelTypes: ["Diesel", "Petrol", "Electric"],
        colors: ["White", "Black", "Gray", "Blue", "Red"],
        transmission: ["Manual", "Automatic"],
        features: ["GPS Navigation", "Air Conditioning", "Tow Hook", "Load Capacity Indicator", "Trailer Compatible"],
        brands: ["Mercedes", "Ford", "Volvo", "Scania", "MAN"]
      }
    }
  },

  Electronics: {
    subcategories: {
      TVs: {
        screenSizes: ["32\"", "40\"", "50\"", "55\"", "65\"", "75\"+"],
        resolution: ["HD", "Full HD", "4K", "8K"],
        features: ["Smart TV", "HDR", "OLED", "LED", "QLED", "Dolby Audio", "Voice Control", "Wi-Fi Connectivity"],
        brands: ["Samsung", "LG", "Sony", "TCL", "Hisense", "Panasonic"]
      },
      Laptops: {
        processors: ["Intel i3", "Intel i5", "Intel i7", "Intel i9", "AMD Ryzen 3-9"],
        ramOptions: ["4 GB", "8 GB", "16 GB", "32 GB", "64 GB"],
        storageOptions: ["128 GB SSD", "256 GB SSD", "512 GB SSD", "1 TB SSD", "2 TB SSD"],
        colors: ["Black", "Silver", "Gray", "Blue", "White"],
        features: ["Backlit Keyboard", "Touchscreen", "Fingerprint Sensor", "Gaming", "Lightweight", "2-in-1 Convertible", "High Refresh Rate Display"],
        brands: ["Apple", "Dell", "HP", "Lenovo", "Asus", "Acer", "Microsoft"]
      },
      Cameras: {
        types: ["DSLR", "Mirrorless", "Point & Shoot", "Action Camera", "Drone Camera"],
        features: ["4K Recording", "Image Stabilization", "Wi-Fi", "Bluetooth", "Waterproof", "Night Mode", "Lens Kit Included"],
        brands: ["Canon", "Nikon", "Sony", "GoPro", "DJI", "Fujifilm"]
      }
    }
  },

  HomeAppliances: {
    subcategories: {
      Refrigerators: {
        types: ["Single Door", "Double Door", "Side-by-Side", "French Door", "Mini Fridge"],
        capacity: ["100L", "200L", "300L", "400L", "500L+"],
        features: ["Frost Free", "Energy Efficient", "Smart Connectivity", "Water Dispenser", "Quick Freeze"],
        brands: ["Samsung", "LG", "Haier", "Hisense", "Bosch", "Whirlpool"]
      },
      WashingMachines: {
        types: ["Front Load", "Top Load", "Semi-Automatic"],
        capacity: ["5 KG", "7 KG", "10 KG", "12 KG+"],
        features: ["Quick Wash", "Energy Saving", "Smart Features", "Inverter Motor", "Child Lock"],
        brands: ["Samsung", "LG", "Bosch", "Whirlpool", "Haier"]
      },
      AirConditioners: {
        types: ["Window", "Split", "Portable", "Inverter"],
        capacity: ["1 Ton", "1.5 Ton", "2 Ton", "2.5 Ton+"],
        features: ["Energy Saving", "Remote Control", "Smart Connectivity", "Fast Cooling", "Dehumidifier Mode"],
        brands: ["LG", "Samsung", "Haier", "Midea", "Panasonic"]
      }
    }
  },

  Fashion: {
    subcategories: {
      Men: {
        clothingTypes: ["Shirts", "T-Shirts", "Jeans", "Trousers", "Jackets", "Suits", "Hoodies"],
        sizes: ["S", "M", "L", "XL", "XXL", "XXXL"],
        colors: ["Black", "White", "Blue", "Gray", "Red", "Green", "Brown"],
        features: ["Cotton", "Slim Fit", "Casual", "Formal", "Hooded", "Waterproof", "Breathable"],
        brands: ["Nike", "Adidas", "Levi's", "Zara", "Gucci", "Puma", "H&M"]
      },
      Women: {
        clothingTypes: ["Dresses", "Tops", "Skirts", "Jeans", "Jackets", "Blouses"],
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        colors: ["Black", "White", "Pink", "Red", "Blue", "Purple", "Beige"],
        features: ["Cotton", "Silk", "Casual", "Formal", "Embroidered", "Stretchable", "Breathable"],
        brands: ["Zara", "H&M", "Gucci", "Nike", "Adidas", "Forever 21"]
      },
      Shoes: {
        types: ["Sneakers", "Formal", "Sandals", "Boots", "Heels", "Loafers"],
        sizes: ["36", "37", "38", "39", "40", "41", "42", "43", "44"],
        colors: ["Black", "White", "Brown", "Red", "Blue", "Beige"],
        features: ["Leather", "Comfort", "Waterproof", "Sporty", "Casual", "Breathable"],
        brands: ["Nike", "Adidas", "Puma", "Reebok", "Clarks", "Gucci"]
      }
    }
  },

  Sports & Outdoors: {
    subcategories: {
      FitnessEquipment: {
        types: ["Treadmill", "Exercise Bike", "Dumbbells", "Yoga Mats", "Resistance Bands"],
        features: ["Foldable", "Digital Display", "Adjustable Weight", "Durable Material", "Lightweight"],
        brands: ["Nike", "Adidas", "Reebok", "ProForm", "Decathlon"]
      },
      Bicycles: {
        types: ["Mountain Bike", "Road Bike", "Hybrid", "Electric Bike", "Kids Bike"],
        features: ["Lightweight Frame", "Shock Absorbers", "Gear System", "Disc Brakes"],
        brands: ["Giant", "Trek", "Merida", "Specialized", "Cannondale"]
      }
    }
  },

  Beauty & Health: {
    subcategories: {
      Skincare: {
        types: ["Moisturizer", "Cleanser", "Serum", "Sunscreen", "Face Mask"],
        brands: ["Neutrogena", "Nivea", "The Ordinary", "Olay", "L'Oréal", "Clinique"]
      },
      Haircare: {
        types: ["Shampoo", "Conditioner", "Hair Oil", "Hair Mask", "Styling Gel"],
        brands: ["Dove", "L'Oréal", "Garnier", "Pantene", "Schwarzkopf"]
      },
      Perfumes: {
        types: ["Men", "Women", "Unisex"],
        brands: ["Chanel", "Dior", "Calvin Klein", "Gucci", "Versace"]
      }
    }
  }
};

export default productOptions;