// /config/productOptions.js

const productOptions = {
  "Mobile Phones & Tablets": {
    subcategories: {
      "Mobile Phones": {
        storageOptions: ["16 GB","32 GB","64 GB","128 GB","256 GB","512 GB","1 TB"],
        colors: ["Black","White","Gray","Gold","Blue","Red","Green","Purple"],
        simTypes: ["Nano-SIM","eSIM","Dual SIM"],
        features: [
          "Bluetooth 5.3","IP68 dust/water resistant","Wireless Charging","Fingerprint Sensor",
          "Face ID","5G Connectivity","Fast Charging","OLED/AMOLED Display",
          "High Refresh Rate Display","Stereo Speakers"
        ],
        brands: [
          "Apple","Samsung","Tecno","Itel","Xiaomi","Huawei","Infinix",
          "Oppo","Vivo","Nokia","Sony","Realme","Motorola","Asus","LG","BlackBerry","HTC"
        ],
        models: {
          Apple: ["iPhone 17 Pro Max","iPhone 17 Pro","iPhone 17","iPhone 16 Pro Max","iPhone 16 Pro"],
          Samsung: ["Galaxy S23 Ultra","Galaxy S23+","Galaxy S23","Galaxy S22 Ultra","Galaxy S22+"],
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
        }
      },
      "Tablets": {
        storageOptions: ["32 GB","64 GB","128 GB","256 GB","512 GB"],
        colors: ["Black","White","Silver","Gold","Blue"],
        simTypes: ["Wi-Fi only","Nano-SIM","eSIM","Cellular + Wi-Fi"],
        features: ["Stylus Support","Face ID","Fingerprint Sensor","4G/5G Connectivity","High-Resolution Display","Long Battery Life","Lightweight Design"],
        brands: ["Apple","Samsung","Huawei","Lenovo","Microsoft","Xiaomi"],
        models: {
          Apple: ["iPad Pro","iPad Air","iPad Mini","iPad 10th Gen"],
          Samsung: ["Galaxy Tab S9","Galaxy Tab S8","Galaxy Tab A8"],
          Huawei: ["MatePad Pro","MatePad 11","MatePad T10"],
          Lenovo: ["Tab P12","Tab M10"],
          Microsoft: ["Surface Pro 9","Surface Go 3"],
          Xiaomi: ["Pad 6","Pad 5"]
        }
      },
      "Phone Accessories": {
        types: ["Charger","Case","Screen Protector","Earphones","Power Bank","Wireless Charger","Cables"],
        colors: ["Black","White","Red","Blue","Transparent"],
        features: ["Fast Charging","Waterproof","Shockproof","Wireless","Durable"],
        brands: ["Anker","Belkin","Spigen","Apple","Samsung","Xiaomi"]
      }
    }
  },

  // ---------------- Keep other categories as before ----------------
  "Electronics": {
    subcategories: {
      "Audio & Music Equipment": { types:["Speakers","Soundbars","Home Theater Systems","DJ Equipment"], features:["Bluetooth","Wireless","Noise Cancelling","Portable","High Bass"], brands:["Sony","Bose","JBL","Yamaha"] },
      "Computer Accessories": { types:["Keyboard","Mouse","Webcam","External Storage","UPS","Cables"], brands:["Logitech","HP","Dell","Lenovo"] },
      "Computer Hardware": { types:["CPU","GPU","RAM","Motherboard","Cooling Systems"], brands:["Intel","AMD","NVIDIA","Corsair"] },
      "Computer Monitors": { screenSizes:["21\"","24\"","27\"","32\"","34\" UltraWide"], features:["HD","Full HD","4K","Curved","High Refresh Rate"], brands:["Samsung","LG","Dell","Acer"] },
      "Headphones": { types:["Over-Ear","On-Ear","In-Ear","Wireless","Gaming"], features:["Noise Cancelling","Bluetooth","Waterproof"], brands:["Sony","Bose","JBL","Sennheiser"] },
      "Laptops & Computers": { processors:["Intel i3","Intel i5","Intel i7","Intel i9","AMD Ryzen 3-9"], ramOptions:["4 GB","8 GB","16 GB","32 GB","64 GB"], storageOptions:["128 GB SSD","256 GB SSD","512 GB SSD","1 TB SSD","2 TB SSD"], colors:["Black","Silver","Gray","Blue","White"], features:["Backlit Keyboard","Touchscreen","Fingerprint Sensor","Gaming","Lightweight","2-in-1 Convertible"], brands:["Apple","Dell","HP","Lenovo","Asus","Acer"] },
      "Networking Products": { types:["Router","Switch","Range Extender","Access Point"], brands:["TP-Link","D-Link","Netgear","Cisco"] },
      "Photo & Video Cameras": { types:["DSLR","Mirrorless","Point & Shoot","Action Camera","Drone Camera"], features:["4K Recording","Image Stabilization","Wi-Fi","Bluetooth","Waterproof","Night Mode"], brands:["Canon","Nikon","Sony","Fujifilm"] },
      "Printers & Scanners": { types:["Inkjet","Laser","All-in-One","3D Printer","Scanner"], brands:["HP","Canon","Epson"] },
      "Security & Surveillance": { types:["CCTV","Alarm System","Smart Doorbell","Motion Sensors"], brands:["Hikvision","Dahua","Arlo","Ring"] },
      "Software": { types:["Operating System","Office Suite","Graphics","CAD","Antivirus"], brands:["Microsoft","Adobe","Corel","Autodesk"] },
      "TV & DVD Equipment": { types:["LED TV","OLED TV","Smart TV","DVD Player","Blu-ray Player"], brands:["Samsung","LG","Sony","TCL","Hisense"] },
      "Video Game Consoles": { types:["Console","Handheld","VR Headset"], brands:["Sony","Microsoft","Nintendo"] },
      "Video Games": { genres:["Action","Adventure","RPG","Simulation","Sports","Strategy"], brands:["EA","Ubisoft","Activision","Nintendo"] }
    }
  },

  "Vehicles": {
    subcategories: {
      "Cars": { fuelTypes:["Petrol","Diesel","Electric","Hybrid"], colors:["Black","White","Silver","Red","Blue","Gray","Green"], transmission:["Manual","Automatic"], features:["Air Conditioning","Power Steering","ABS","Sunroof","GPS","Bluetooth","Parking Sensors","Cruise Control"], brands:["Toyota","Honda","Ford","BMW","Mercedes","Nissan","Hyundai","Kia"] },
      "Motorcycles": { fuelTypes:["Petrol","Electric"], colors:["Black","Red","Blue","White","Yellow"], transmission:["Manual","Automatic"], features:["ABS Brakes","LED Headlights","Disc Brakes","Storage Compartment","Sport Design"], brands:["Yamaha","Honda","Suzuki","KTM","Bajaj"] },
      "Trucks": { fuelTypes:["Diesel","Petrol","Electric"], colors:["White","Black","Gray","Blue","Red"], transmission:["Manual","Automatic"], features:["GPS Navigation","Air Conditioning","Tow Hook","Load Capacity Indicator","Trailer Compatible"], brands:["Mercedes","Volvo","Scania","MAN","Ford"] },
      "Buses": { fuelTypes:["Diesel","Petrol","Electric"], features:["Air Conditioning","Seating Capacity","GPS Navigation"], brands:["Mercedes","Volvo","Scania","Iveco"] },
      "Spare Parts": { types:["Engine","Brakes","Suspension","Electrical","Body Parts"], brands:["Bosch","Valeo","Delphi","ACDelco"] }
    }
  },

  "Property": {
    subcategories: {
      "Houses": { types:["Detached","Semi-Detached","Townhouse","Bungalow","Villa"], bedrooms:[1,2,3,4,5,6], bathrooms:[1,2,3,4], features:["Swimming Pool","Garage","Garden","Balcony","Furnished","Gated Community"] },
      "Apartments & Flats": { types:["Studio","1 Bedroom","2 Bedroom","3 Bedroom","Penthouse"], features:["Furnished","Balcony","Elevator","Security","Parking"] },
      "Land": { types:["Residential","Commercial","Agricultural","Industrial"], sizeOptions:["<500 sqm","500-1000 sqm","1000-5000 sqm","5000+ sqm"], features:["Near Road","Electricity Available","Water Available"] },
      "Commercial Property": { types:["Office Space","Shop","Warehouse","Industrial Building"], features:["Parking","Security","Elevator","Storage"] },
      "Vacation Rentals": { types:["Beach House","Villa","Cabin","Apartment"], features:["Swimming Pool","Furnished","Sea View","Pet Friendly"] }
    }
  },

  // ...other categories remain same as before
};

export default productOptions;