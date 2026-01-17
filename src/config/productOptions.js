// /config/productOptions.js

const productOptions = {
  "Mobile Phones & Tablets": {
    subcategories: {
      "Mobile Phones": {
        storageOptions: ["16 GB","32 GB","64 GB","128 GB","256 GB","512 GB","1 TB"],
        colors: ["Black","White","Gray","Gold","Blue","Red","Green","Purple"],
        simTypes: ["Nano-SIM","eSIM","Dual SIM"],
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
          "Stereo Speakers"
        ],
        brands: [
          "AGM","Advan","Alcatel","Allview","Amoi","Apple","Archos","Asus",
          "BlackBerry","Blackview","BQ","BLU","CAT","Casio","Cherry Mobile",
          "Cherry Mobile Flare","Cubot","Cubot Rugged","Doogee","Energizer",
          "Elephone","Ericsson","Fairphone","FiiO","Fly","Gionee","Gigabyte",
          "Google","Gtel","Homtom","HTC","Huawei","Honor","i-mobile","itel",
          "Itel Mobile","Jolla","Karbonn","Karbonn Titanium","Kyocera","Lava",
          "Lava Iris","Lenovo","LeEco","Maze","Maxcom","Meizu","Micromax",
          "Micromax Canvas","Motorola","MyPhone","NEC","Nokia","Nomu","Nothing",
          "Nubia","Oppo","Oppo Real","Onyx","Panasonic","Poco","Posh Mobile",
          "Prestigio","QMobile","RCA","Realme","Saygus","Sharp","Siemens",
          "Sony","Spice","TCL","Tecno","Tecno Mobile","Toshiba","Ulefone",
          "Unihertz","VK Mobile","Vivo","Vkworld","Wiko","Xiaomi","Zonda",
          "Zonda Mobile","ZTE"
        ]
      },
      "Tablets": {
        storageOptions: ["32 GB","64 GB","128 GB","256 GB","512 GB"],
        colors: ["Black","White","Silver","Gold","Blue"],
        simTypes: ["Wi-Fi only","Nano-SIM","eSIM","Cellular + Wi-Fi"],
        features: ["Stylus Support","Face ID","Fingerprint Sensor","4G/5G Connectivity","High-Resolution Display","Long Battery Life","Lightweight Design"],
        brands: ["Apple","Samsung","Huawei","Lenovo","Microsoft","Xiaomi"]
      },
      "Phone Accessories": {
        types: ["Charger","Case","Screen Protector","Earphones","Power Bank","Wireless Charger","Cables"],
        colors: ["Black","White","Red","Blue","Transparent"],
        features: ["Fast Charging","Waterproof","Shockproof","Wireless","Durable"],
        brands: ["Anker","Belkin","Spigen","Apple","Samsung","Xiaomi"]
      }
    }
  },

  "Electronics": {
    subcategories: {
      "Audio & Music Equipment": {
        types: ["Speakers","Soundbars","Home Theater Systems","DJ Equipment"],
        features: ["Bluetooth","Wireless","Noise Cancelling","Portable","High Bass"],
        brands: ["Sony","Bose","JBL","Yamaha"]
      },
      "Computer Accessories": {
        types: ["Keyboard","Mouse","Webcam","External Storage","UPS","Cables"],
        brands: ["Logitech","HP","Dell","Lenovo"]
      },
      "Computer Hardware": {
        types: ["CPU","GPU","RAM","Motherboard","Cooling Systems"],
        brands: ["Intel","AMD","NVIDIA","Corsair"]
      },
      "Computer Monitors": {
        screenSizes: ["21\"","24\"","27\"","32\"","34\" UltraWide"],
        features: ["HD","Full HD","4K","Curved","High Refresh Rate"],
        brands: ["Samsung","LG","Dell","Acer"]
      },
      "Headphones": {
        types: ["Over-Ear","On-Ear","In-Ear","Wireless","Gaming"],
        features: ["Noise Cancelling","Bluetooth","Waterproof"],
        brands: ["Sony","Bose","JBL","Sennheiser"]
      },
      "Laptops & Computers": {
        processors: ["Intel i3","Intel i5","Intel i7","Intel i9","AMD Ryzen 3-9"],
        ramOptions: ["4 GB","8 GB","16 GB","32 GB","64 GB"],
        storageOptions: ["128 GB SSD","256 GB SSD","512 GB SSD","1 TB SSD","2 TB SSD"],
        colors: ["Black","Silver","Gray","Blue","White"],
        features: ["Backlit Keyboard","Touchscreen","Fingerprint Sensor","Gaming","Lightweight","2-in-1 Convertible"],
        brands: ["Apple","Dell","HP","Lenovo","Asus","Acer"]
      },
      "Networking Products": {
        types: ["Router","Switch","Range Extender","Access Point"],
        brands: ["TP-Link","D-Link","Netgear","Cisco"]
      },
      "Photo & Video Cameras": {
        types: ["DSLR","Mirrorless","Point & Shoot","Action Camera","Drone Camera"],
        features: ["4K Recording","Image Stabilization","Wi-Fi","Bluetooth","Waterproof","Night Mode"],
        brands: ["Canon","Nikon","Sony","Fujifilm"]
      },
      "Printers & Scanners": {
        types: ["Inkjet","Laser","All-in-One","3D Printer","Scanner"],
        brands: ["HP","Canon","Epson"]
      },
      "Security & Surveillance": {
        types: ["CCTV","Alarm System","Smart Doorbell","Motion Sensors"],
        brands: ["Hikvision","Dahua","Arlo","Ring"]
      },
      "Software": {
        types: ["Operating System","Office Suite","Graphics","CAD","Antivirus"],
        brands: ["Microsoft","Adobe","Corel","Autodesk"]
      },
      "TV & DVD Equipment": {
        types: ["LED TV","OLED TV","Smart TV","DVD Player","Blu-ray Player"],
        brands: ["Samsung","LG","Sony","TCL","Hisense"]
      },
      "Video Game Consoles": {
        types: ["Console","Handheld","VR Headset"],
        brands: ["Sony","Microsoft","Nintendo"]
      },
      "Video Games": {
        genres: ["Action","Adventure","RPG","Simulation","Sports","Strategy"],
        brands: ["EA","Ubisoft","Activision","Nintendo"]
      }
    }
  },

  "Vehicles": {
    subcategories: {
      "Cars": {
        fuelTypes: ["Petrol","Diesel","Electric","Hybrid"],
        colors: ["Black","White","Silver","Red","Blue","Gray","Green"],
        transmission: ["Manual","Automatic"],
        features: ["Air Conditioning","Power Steering","ABS","Sunroof","GPS","Bluetooth","Parking Sensors","Cruise Control"],
        brands: ["Toyota","Honda","Ford","BMW","Mercedes","Nissan","Hyundai","Kia"]
      },
      "Motorcycles": {
        fuelTypes: ["Petrol","Electric"],
        colors: ["Black","Red","Blue","White","Yellow"],
        transmission: ["Manual","Automatic"],
        features: ["ABS Brakes","LED Headlights","Disc Brakes","Storage Compartment","Sport Design"],
        brands: ["Yamaha","Honda","Suzuki","KTM","Bajaj"]
      },
      "Trucks": {
        fuelTypes: ["Diesel","Petrol","Electric"],
        colors: ["White","Black","Gray","Blue","Red"],
        transmission: ["Manual","Automatic"],
        features: ["GPS Navigation","Air Conditioning","Tow Hook","Load Capacity Indicator","Trailer Compatible"],
        brands: ["Mercedes","Volvo","Scania","MAN","Ford"]
      },
      "Buses": {
        fuelTypes: ["Diesel","Petrol","Electric"],
        features: ["Air Conditioning","Seating Capacity","GPS Navigation"],
        brands: ["Mercedes","Volvo","Scania","Iveco"]
      },
      "Spare Parts": {
        types: ["Engine","Brakes","Suspension","Electrical","Body Parts"],
        brands: ["Bosch","Valeo","Delphi","ACDelco"]
      }
    }
  },

  "Property": {
    subcategories: {
      "Houses": {
        types: ["Detached","Semi-Detached","Townhouse","Bungalow","Villa"],
        bedrooms: [1,2,3,4,5,6],
        bathrooms: [1,2,3,4],
        features: ["Swimming Pool","Garage","Garden","Balcony","Furnished","Gated Community"]
      },
      "Apartments & Flats": {
        types: ["Studio","1 Bedroom","2 Bedroom","3 Bedroom","Penthouse"],
        features: ["Furnished","Balcony","Elevator","Security","Parking"]
      },
      "Land": {
        types: ["Residential","Commercial","Agricultural","Industrial"],
        sizeOptions: ["<500 sqm","500-1000 sqm","1000-5000 sqm","5000+ sqm"],
        features: ["Near Road","Electricity Available","Water Available"]
      },
      "Commercial Property": {
        types: ["Office Space","Shop","Warehouse","Industrial Building"],
        features: ["Parking","Security","Elevator","Storage"]
      },
      "Vacation Rentals": {
        types: ["Beach House","Villa","Cabin","Apartment"],
        features: ["Swimming Pool","Furnished","Sea View","Pet Friendly"]
      }
    }
  },

  "Home, Furniture & Appliances": {
    subcategories: {
      "Furniture": {
        types: ["Sofa","Bed","Dining Table","Wardrobe","Chair","Desk"],
        brands: ["IKEA","Ashley","Wayfair"]
      },
      "Kitchen Appliances": {
        types: ["Microwave","Oven","Blender","Juicer","Coffee Maker","Food Processor"],
        brands: ["LG","Samsung","Philips","Panasonic"]
      },
      "Lighting": {
        types: ["LED","Chandelier","Lamp","Ceiling Light","Wall Light"],
        brands: ["Philips","IKEA","Osram"]
      },
      "Decor": {
        types: ["Vase","Clock","Wall Art","Rug","Curtains"],
        brands: ["IKEA","Wayfair","Home Centre"]
      },
      "Cleaning Supplies": {
        types: ["Detergent","Broom","Mop","Disinfectant","Vacuum Cleaner"],
        brands: ["Dettol","Vileda","Harpic"]
      }
    }
  },

  "Fashion": {
    subcategories: {
      "Clothing": {
        types: ["Shirts","T-Shirts","Jeans","Jackets","Dresses","Skirts"],
        sizes: ["XS","S","M","L","XL","XXL"],
        colors: ["Black","White","Blue","Red","Gray","Pink","Green"],
        brands: ["Nike","Adidas","Levi's","Zara"]
      },
      "Shoes": {
        types: ["Sneakers","Boots","Formal","Sandals","Heels"],
        sizes: ["36","37","38","39","40","41","42"],
        colors: ["Black","White","Brown","Red","Blue"],
        brands: ["Nike","Adidas","Puma","Reebok"]
      },
      "Accessories": {
        types: ["Watch","Sunglasses","Belt","Hat","Scarf"],
        brands: ["Ray-Ban","Fossil","Gucci"]
      },
      "Bags": {
        types: ["Backpack","Handbag","Messenger","Tote"],
        brands: ["Louis Vuitton","Gucci","Michael Kors"]
      },
      "Jewelry": {
        types: ["Ring","Necklace","Bracelet","Earrings"],
        brands: ["Cartier","Tiffany","Swarovski"]
      }
    }
  },

  "Beauty & Personal Care": {
    subcategories: {
      "Cosmetics": {
        types: ["Lipstick","Foundation","Eyeliner","Blush","Mascara"],
        brands: ["Maybelline","MAC","Fenty Beauty"]
      },
      "Hair Care": {
        types: ["Shampoo","Conditioner","Hair Oil","Hair Mask"],
        brands: ["L'Oreal","Dove","Pantene"]
      },
      "Skincare": {
        types: ["Moisturizer","Cleanser","Serum","Sunscreen","Face Mask"],
        brands: ["Nivea","Neutrogena","The Body Shop"]
      },
      "Fragrances": {
        types: ["Perfume","Cologne"],
        brands: ["Chanel","Dior","Gucci"]
      }
    }
  },

  "Services": {
    subcategories: {
      "Tutoring": { types: ["Math","Science","Languages","Music","Art"] },
      "Transportation": { types: ["Taxi","Delivery","Logistics","Moving"] },
      "Events": { types: ["Wedding","Birthday","Corporate","Concert"] },
      "Health & Wellness": { types: ["Personal Trainer","Nutritionist","Therapy","Massage"] }
    }
  },

  "Repair & Construction": {
    subcategories: {
      "Plumbing": { types: ["Residential","Commercial"] },
      "Electrical": { types: ["Residential","Commercial"] },
      "Painting": { types: ["Interior","Exterior"] },
      "Renovation": { types: ["Kitchen","Bathroom","Full House"] }
    }
  },

  "Commercial Equipment & Tools": {
    subcategories: {
      "Machinery": { types: ["Excavator","Bulldozer","Crane"] },
      "Industrial Tools": { types: ["Drill","Welder","Compressor"] },
      "Office Equipment": { types: ["Printer","Scanner","Copier","Shredder"] }
    }
  },

  "Leisure & Activities": {
    subcategories: {
      "Sports Equipment": { types: ["Ball Sports","Rackets","Protective Gear"] },
      "Gym & Fitness": { types: ["Treadmill","Weights","Exercise Bike"] },
      "Outdoor Activities": { types: ["Camping","Hiking","Fishing"] },
      "Hobbies": { types: ["Art Supplies","Musical Instruments","Collectibles"] }
    }
  },

  "Babies & Kids": {
    subcategories: {
      "Toys": { types: ["Educational","Action Figures","Dolls","Puzzles"] },
      "Clothing": { sizes: ["0-3m","3-6m","6-12m","1-2y","3-5y","6-10y"] },
      "Strollers": { types: ["Single","Double","Travel System"] },
      "Baby Care": { types: ["Diapers","Wipes","Baby Lotion","Feeding"] }
    }
  },

  "Food, Agriculture & Farming": {
    subcategories: {
      "Produce": { types: ["Vegetables","Fruits","Herbs"] },
      "Livestock": { types: ["Cattle","Sheep","Goats","Poultry"] },
      "Farm Equipment": { types: ["Tractors","Ploughs","Irrigation Systems"] }
    }
  },

  "Animals & Pets": {
    subcategories: {
      "Pets": { types: ["Dogs","Cats","Birds","Fish","Reptiles"] },
      "Pet Food": { types: ["Dog Food","Cat Food","Bird Seed","Fish Food"] },
      "Pet Accessories": { types: ["Leashes","Toys","Cages","Beds"] }
    }
  },

  "Jobs": {
    subcategories: {
      "Full-time": { types: ["IT","Healthcare","Engineering","Education","Sales"] },
      "Part-time": { types: ["Retail","Hospitality","Freelance","Tutoring"] },
      "Freelance": { types: ["Design","Writing","Programming","Marketing"] }
    }
  },

  "Seeking Work - CVs": {
    subcategories: {
      "CVs": { types: ["IT","Healthcare","Engineering","Education","Sales"] },
      "Portfolios": { types: ["Design","Writing","Programming","Marketing"] }
    }
  }
};

export default productOptions;