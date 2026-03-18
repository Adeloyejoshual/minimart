// helpers/assignCategories.js
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

// Map category keywords to IDs
const categoryMap = [
  { id: "102055d1-180a-4b8f-a39b-3b20a4838e90", keywords: ["Phone", "Tablet", "iPhone", "Samsung"] },
  { id: "20371324-5130-4952-91ed-29cf67c93f72", keywords: ["Service", "Consulting", "Repair"] },
  { id: "3079d791-8695-47ef-aaa1-78b9eabb32fe", keywords: ["Job", "Career", "Hiring"] },
  { id: "39dc4492-0754-4826-816b-bc32f31081d0", keywords: ["Equipment", "Tool", "Machine"] },
  { id: "3c93ad90-2b69-4072-b2cb-748384f44d3f", keywords: ["Sport", "Outdoor", "Gym"] },
  { id: "46f8dcab-69d0-4fa0-aead-f9ab6c64c139", keywords: ["Construction", "Builder"] },
  { id: "4aba6a69-2b1c-4b19-9ca0-3b2630ef6fdb", keywords: ["Beauty", "Makeup", "Skincare"] },
  { id: "4bb82894-f6aa-478a-8541-da3305d5a293", keywords: ["Home", "Furniture", "Appliance"] },
  { id: "4d13f1aa-bd53-49a1-9e86-cf33ece1b254", keywords: ["Leisure", "Hobby", "Activity"] },
  { id: "6609d41f-7fd5-469d-8155-9a7c0a7d05f3", keywords: ["Health", "Fitness", "Blood Pressure"] },
  { id: "754e63f4-7e20-483c-a9c2-6782e615bd2d", keywords: ["Baby", "Kids"] },
  { id: "85d13ecd-a84a-4c39-8358-db890206e280", keywords: ["Art", "Collectible"] },
  { id: "8ba64fb7-33a6-415e-a895-38d778a49075", keywords: ["Fashion", "Clothes"] },
  { id: "947ce100-d961-4455-bfbf-c1d33537f11b", keywords: ["Book", "Stationery"] },
  { id: "b2345835-2bf3-4749-a1e9-760e8159ecc6", keywords: ["Vehicle", "Car", "Motorbike"] },
  { id: "b236303d-3ccf-4169-8321-81243d796481", keywords: ["Game", "Gaming", "Console"] },
  { id: "bba9b3e7-4118-42c4-9ea9-4aa2afd445dc", keywords: ["Electronic", "Gadget"] },
  { id: "c96bba5b-a9f8-43ed-8dbb-3326f34e07c0", keywords: ["Property", "House", "Land"] },
  { id: "cb32087f-c235-466e-9e75-6fbee393903b", keywords: ["Part", "Accessory"] },
  { id: "cf185f2a-d291-40cc-8694-67291f1a6a26", keywords: ["Food", "Farm", "Agriculture"] },
  { id: "d30edb05-1f94-41e6-9400-6f8d8252a29b", keywords: ["Toy", "Game"] },
  { id: "d6b767d7-1f3b-46cc-9e67-00b699e4ec04", keywords: ["CV", "Resume", "Seeking Work"] },
  { id: "e6d02486-ce55-4718-a096-6af8001d4a2c", keywords: ["Instrument", "Music"] },
  { id: "e70d46b2-9450-42ee-a938-4235c319b8b3", keywords: ["Pet", "Dog", "Cat"] },
  { id: "fc1acba9-a5ca-4a82-8305-81586ecb75e1", keywords: ["Computer", "Laptop"] },
];

async function assignCategories() {
  try {
    const { rows: products } = await pool.query(
      "SELECT id, title, category_id FROM products WHERE category_id IS NULL"
    );

    for (const product of products) {
      let matchedCategory = null;

      for (const category of categoryMap) {
        if (category.keywords.some(keyword => product.title.includes(keyword))) {
          matchedCategory = category.id;
          break;
        }
      }

      if (matchedCategory) {
        await pool.query(
          "UPDATE products SET category_id = $1 WHERE id = $2",
          [matchedCategory, product.id]
        );
        console.log(`Updated product "${product.title}" with category ${matchedCategory}`);
      } else {
        console.log(`No matching category for product "${product.title}"`);
      }
    }

    console.log("Category assignment complete.");
    process.exit(0);
  } catch (err) {
    console.error("Error assigning categories:", err);
    process.exit(1);
  }
}

assignCategories();