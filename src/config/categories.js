// src/config/categories.js

const categories = [
  {
    id: "mobile_devices",
    name: "Mobile Phones & Tablets",
    icon: "icons/mobile.png",
    subcategories: [
      {
        id: "mobile_phones",
        name: "Mobile Phones",
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
      { id: "mobile_tablets", name: "Tablets" },
      { id: "mobile_accessories", name: "Phone Accessories" },
    ],
  },
  {
    id: "vehicles",
    name: "Vehicles",
    icon: "icons/vehicle.png",
    subcategories: [
      { id: "cars", name: "Cars", brands: ["Toyota","Honda","Ford","BMW","Mercedes","Nissan","Hyundai","Kia"] },
      { id: "motorcycles", name: "Motorcycles", brands: ["Yamaha","Honda","Suzuki","KTM","Bajaj"] },
      { id: "trucks", name: "Trucks", brands: ["Mercedes","Volvo","Scania","MAN","Ford"] },
      { id: "buses", name: "Buses", brands: ["Mercedes","Volvo","Scania","Iveco"] },
      { id: "spare_parts", name: "Spare Parts", brands: ["Bosch","Valeo","Delphi","ACDelco"] },
    ],
  },
  {
    id: "property",
    name: "Property",
    icon: "icons/property.png",
    subcategories: [
      { id: "houses", name: "Houses" },
      { id: "apartments", name: "Apartments & Flats" },
      { id: "land", name: "Land" },
      { id: "commercial", name: "Commercial Property" },
      { id: "vacation_rentals", name: "Vacation Rentals" },
    ],
  },
  {
    id: "electronics",
    name: "Electronics",
    icon: "icons/electronics.png",
    subcategories: [
      { id: "audio_music", name: "Audio & Music Equipment", brands: ["Sony","Bose","JBL","Yamaha"] },
      { id: "computer_accessories", name: "Computer Accessories", brands: ["Logitech","HP","Dell","Lenovo"] },
      { id: "computer_hardware", name: "Computer Hardware", brands: ["Intel","AMD","NVIDIA","Corsair"] },
      { id: "monitors", name: "Computer Monitors", brands: ["Samsung","LG","Dell","Acer"] },
      { id: "headphones", name: "Headphones", brands: ["Sony","Bose","JBL","Sennheiser"] },
      { id: "laptops", name: "Laptops & Computers", brands: ["Apple","Dell","HP","Lenovo","Asus","Acer"] },
      { id: "networking", name: "Networking Products", brands: ["TP-Link","D-Link","Netgear","Cisco"] },
      { id: "cameras", name: "Photo & Video Cameras", brands: ["Canon","Nikon","Sony","Fujifilm"] },
      { id: "printers", name: "Printers & Scanners", brands: ["HP","Canon","Epson"] },
      { id: "security", name: "Security & Surveillance", brands: ["Hikvision","Dahua","Arlo","Ring"] },
      { id: "software", name: "Software", brands: ["Microsoft","Adobe","Corel","Autodesk"] },
      { id: "tv_dvd", name: "TV & DVD Equipment", brands: ["Samsung","LG","Sony","TCL","Hisense"] },
      { id: "video_game_consoles", name: "Video Game Consoles", brands: ["Sony","Microsoft","Nintendo"] },
      { id: "video_games", name: "Video Games", brands: ["EA","Ubisoft","Activision","Nintendo"] },
    ],
  },
  {
    id: "home_furniture",
    name: "Home, Furniture & Appliances",
    icon: "icons/home.png",
    subcategories: [
      { id: "furniture", name: "Furniture", brands: ["IKEA","Ashley","Wayfair"] },
      { id: "kitchen_appliances", name: "Kitchen Appliances", brands: ["LG","Samsung","Philips","Panasonic"] },
      { id: "lighting", name: "Lighting", brands: ["Philips","IKEA","Osram"] },
      { id: "decor", name: "Decor", brands: ["IKEA","Wayfair","Home Centre"] },
      { id: "cleaning", name: "Cleaning Supplies", brands: ["Dettol","Vileda","Harpic"] },
    ],
  },
  {
    id: "fashion",
    name: "Fashion",
    icon: "icons/fashion.png",
    subcategories: [
      { id: "clothing", name: "Clothing", brands: ["Nike","Adidas","Levi's","Zara"] },
      { id: "shoes", name: "Shoes", brands: ["Nike","Adidas","Puma","Reebok"] },
      { id: "accessories", name: "Accessories", brands: ["Ray-Ban","Fossil","Gucci"] },
      { id: "bags", name: "Bags", brands: ["Louis Vuitton","Gucci","Michael Kors"] },
      { id: "jewelry", name: "Jewelry", brands: ["Cartier","Tiffany","Swarovski"] },
    ],
  },
  {
    id: "beauty",
    name: "Beauty & Personal Care",
    icon: "icons/beauty.png",
    subcategories: [
      { id: "cosmetics", name: "Cosmetics", brands: ["Maybelline","MAC","Fenty Beauty"] },
      { id: "haircare", name: "Hair Care", brands: ["L'Oreal","Dove","Pantene"] },
      { id: "skincare", name: "Skincare", brands: ["Nivea","Neutrogena","The Body Shop"] },
      { id: "fragrances", name: "Fragrances", brands: ["Chanel","Dior","Gucci"] },
    ],
  },
  {
    id: "services",
    name: "Services",
    icon: "icons/services.png",
    subcategories: [
      { id: "tutoring", name: "Tutoring" },
      { id: "transportation", name: "Transportation" },
      { id: "events", name: "Events" },
      { id: "health_wellness", name: "Health & Wellness" },
    ],
  },
  {
    id: "repair_construction",
    name: "Repair & Construction",
    icon: "icons/repair.png",
    subcategories: [
      { id: "plumbing", name: "Plumbing" },
      { id: "electrical", name: "Electrical" },
      { id: "painting", name: "Painting" },
      { id: "renovation", name: "Renovation" },
    ],
  },
  {
    id: "commercial_tools",
    name: "Commercial Equipment & Tools",
    icon: "icons/tools.png",
    subcategories: [
      { id: "machinery", name: "Machinery" },
      { id: "industrial_tools", name: "Industrial Tools" },
      { id: "office_equipment", name: "Office Equipment" },
    ],
  },
  {
    id: "leisure",
    name: "Leisure & Activities",
    icon: "icons/leisure.png",
    subcategories: [
      { id: "sports_equipment", name: "Sports Equipment" },
      { id: "gym_fitness", name: "Gym & Fitness" },
      { id: "outdoor", name: "Outdoor Activities" },
      { id: "hobbies", name: "Hobbies" },
    ],
  },
  {
    id: "babies_kids",
    name: "Babies & Kids",
    icon: "icons/babies.png",
    subcategories: [
      { id: "toys", name: "Toys" },
      { id: "clothing", name: "Clothing" },
      { id: "strollers", name: "Strollers" },
      { id: "baby_care", name: "Baby Care" },
    ],
  },
  {
    id: "food_agriculture",
    name: "Food, Agriculture & Farming",
    icon: "icons/food.png",
    subcategories: [
      { id: "produce", name: "Produce" },
      { id: "livestock", name: "Livestock" },
      { id: "farm_equipment", name: "Farm Equipment" },
    ],
  },
  {
    id: "animals_pets",
    name: "Animals & Pets",
    icon: "icons/animals.png",
    subcategories: [
      { id: "pets", name: "Pets" },
      { id: "pet_food", name: "Pet Food" },
      { id: "pet_accessories", name: "Pet Accessories" },
    ],
  },
  {
    id: "jobs",
    name: "Jobs",
    icon: "icons/jobs.png",
    subcategories: [
      { id: "full_time", name: "Full-time" },
      { id: "part_time", name: "Part-time" },
      { id: "freelance", name: "Freelance" },
    ],
  },
  {
    id: "seeking_work",
    name: "Seeking Work - CVs",
    icon: "icons/cv.png",
    subcategories: [
      { id: "cvs", name: "CVs" },
      { id: "portfolios", name: "Portfolios" },
    ],
  },
];

export default categories;