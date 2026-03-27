import express from "express";
import { Pool } from "pg";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

/* ================= UI CONFIGS (UNCHANGED) ================= */
import { brands } from "../src/config/brands.js";
import { colors } from "../src/config/colors.js";
import { categoryFields } from "../src/config/categoryFields.js";
import { conditions, usedDetails } from "../src/config/conditions.js";
import { featuresByCategory } from "../src/config/featuresByCategory.js";
import { models } from "../src/config/models.js";
import { ramOptions } from "../src/config/ramOptions.js";
import { sims } from "../src/config/sims.js";
import { storageOptions } from "../src/config/storageOptions.js";
import { years } from "../src/config/years.js";
import { engines } from "../src/config/engines.js";
import { fuelTypes } from "../src/config/fuelTypes.js";
import { locationsByState } from "../src/config/locationsByState.js";
import { promotionPlans } from "../src/config/promotions.js";

dotenv.config();

const router = express.Router();

/* ================= DB ================= */
const pool = new Pool({
connectionString: process.env.COCKROACH_URI,
ssl: { rejectUnauthorized: false },
});

/* ================= CLOUDINARY ================= */
cloudinary.config({
cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
api_key: process.env.CLOUDINARY_API_KEY,
api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ================= MULTER ================= */
const upload = multer({
storage: multer.memoryStorage(),
limits: { fileSize: 5 * 1024 * 1024, files: 10 },
fileFilter: (req, file, cb) => {
if (!file.mimetype.startsWith("image/")) {
return cb(new Error("Only images allowed"), false);
}
cb(null, true);
},
});

/* ================= NORMALIZER ================= */
const normalizeProduct = (p) => ({
...p,
images: Array.isArray(p.images) ? p.images : [],
attributes: p.attributes || {},
delivery: p.delivery || {},
contact: p.contact || {},
location: {
state: p.location_state,
city: p.location_city,
},
promotion:
promotionPlans.find((x) => x.id == p.promotion_id) || null,
});

/* =========================================================
GET PRODUCTS
========================================================= */
router.get("/products", async (req, res) => {
try {
let { skip = 0, limit = 20 } = req.query;

skip = Math.max(parseInt(skip) || 0, 0);  
limit = Math.min(parseInt(limit) || 20, 50);  

const baseQuery = `  
  SELECT   
    p.*,  
    COALESCE(  
      json_agg(pi.image_url ORDER BY pi.position)  
      FILTER (WHERE pi.image_url IS NOT NULL),  
      '[]'  
    ) AS images  
  FROM products p  
  LEFT JOIN product_images pi ON p.id = pi.product_id  
  WHERE p.is_active = true  
  GROUP BY p.id  
`;  

const trendingRes = await pool.query(`  
  ${baseQuery}  
  ORDER BY p.views DESC NULLS LAST  
  LIMIT 6  
`);  

const productsRes = await pool.query(  
  `  
  ${baseQuery}  
  ORDER BY p.created_at DESC  
  OFFSET $1 LIMIT $2  
  `,  
  [skip, limit]  
);  

const trending = trendingRes.rows.map(normalizeProduct);  
const products = productsRes.rows.map(normalizeProduct);  

const trendingIds = new Set(trending.map((p) => p.id));  

res.json({  
  trending,  
  products: [  
    ...trending,  
    ...products.filter((p) => !trendingIds.has(p.id)),  
  ],  
});

} catch (err) {
console.error(err);
res.status(500).json({ message: "Failed to fetch products" });
}
});

/* =========================================================
GET SINGLE PRODUCT
========================================================= */
router.get("/products/:id", async (req, res) => {
try {
const { id } = req.params;

const { rows } = await pool.query(  
  `  
  SELECT   
    p.*,  
    COALESCE(  
      json_agg(pi.image_url ORDER BY pi.position)  
      FILTER (WHERE pi.image_url IS NOT NULL),  
      '[]'  
    ) AS images  
  FROM products p  
  LEFT JOIN product_images pi ON p.id = pi.product_id  
  WHERE p.id = $1  
  GROUP BY p.id  
  `,  
  [id]  
);  

if (!rows.length) {  
  return res.status(404).json({ message: "Product not found" });  
}  

const product = normalizeProduct(rows[0]);  

pool.query(  
  "UPDATE products SET views = COALESCE(views,0)+1 WHERE id=$1",  
  [id]  
).catch(() => {});  

res.json(product);

} catch (err) {
console.error(err);
res.status(500).json({ message: "Failed to fetch product" });
}
});

/* =========================================================
CREATE PRODUCT
========================================================= */
router.post("/products", upload.array("images", 10), async (req, res) => {
const client = await pool.connect();

try {
await client.query("BEGIN");

const title = req.body.title;  
const price = Number(req.body.price);  
const category_id = req.body.category_id;  

if (!title || !price || !category_id) {  
  return res.status(400).json({ message: "Missing required fields" });  
}  

const attributes = {  
  brand: req.body.brand || null,  
  model: req.body.model || null,  
  color: req.body.color || null,  
  condition: req.body.condition || null,  
  used_detail: req.body.used_detail || null,  
  engine: req.body.engine || null,  
  year: req.body.year || null,  
  fuel_type: req.body.fuel_type || null,  
  features: req.body.features || null,  
  ram: req.body.ram || null,  
  storage: req.body.storage || null,  
  sim: req.body.sim || null,  
};  

const delivery = req.body.delivery  
  ? JSON.parse(req.body.delivery)  
  : {};  

const contact = req.body.contact  
  ? JSON.parse(req.body.contact)  
  : {};  

const { rows } = await client.query(  
  `  
  INSERT INTO products (  
    title,  
    description,  
    price,  
    category_id,  
    subcategory_id,  
    attributes,  
    delivery,  
    contact,  
    promotion_id,  
    location_state,  
    location_city,  
    created_at,  
    updated_at  
  )  
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now())  
  RETURNING *  
  `,  
  [  
    title,  
    req.body.description || "",  
    price,  
    category_id,  
    req.body.subcategory_id || null,  
    attributes,  
    delivery,  
    contact,  
    req.body.promotion_id || null,  
    req.body.location_state || null,  
    req.body.location_city || null,  
  ]  
);  

const product = rows[0];  

/* ================= IMAGES ================= */  
if (req.files?.length) {  
  const uploads = await Promise.all(  
    req.files.map(  
      (file, index) =>  
        new Promise((resolve, reject) => {  
          const stream = cloudinary.uploader.upload_stream(  
            {  
              folder: "products",  
              transformation: [  
                { width: 900, height: 900, crop: "limit" },  
                { quality: "auto" },  
                { fetch_format: "auto" },  
              ],  
            },  
            (err, result) => {  
              if (err) return reject(err);  
              resolve({  
                url: result.secure_url,  
                position: index,  
              });  
            }  
          );  
          stream.end(file.buffer);  
        })  
    )  
  );  

  for (const img of uploads) {  
    await client.query(  
      `  
      INSERT INTO product_images (product_id, image_url, position)  
      VALUES ($1,$2,$3)  
      `,  
      [product.id, img.url, img.position]  
    );  
  }  
}  

await client.query("COMMIT");  

res.status(201).json(normalizeProduct(product));

} catch (err) {
await client.query("ROLLBACK");
console.error(err);
res.status(500).json({ message: "Failed to create product" });
} finally {
client.release();
}
});

/* =========================================================
UPDATE PRODUCT (FULL CONTROL)
========================================================= */
router.put("/products/:id", upload.array("images", 10), async (req, res) => {
const client = await pool.connect();

try {
await client.query("BEGIN");

const { id } = req.params;  

const { rows } = await client.query(  
  `SELECT * FROM products WHERE id=$1`,  
  [id]  
);  

if (!rows.length) {  
  return res.status(404).json({ message: "Product not found" });  
}  

const delivery = req.body.delivery  
  ? JSON.parse(req.body.delivery)  
  : rows[0].delivery;  

const contact = req.body.contact  
  ? JSON.parse(req.body.contact)  
  : rows[0].contact;  

await client.query(  
  `  
  UPDATE products SET  
    title = COALESCE($1,title),  
    description = COALESCE($2,description),  
    price = COALESCE($3,price),  
    attributes = COALESCE($4,attributes),  
    delivery = $5,  
    contact = $6,  
    location_state = COALESCE($7,location_state),  
    location_city = COALESCE($8,location_city),  
    updated_at = now()  
  WHERE id=$9  
  `,  
  [  
    req.body.title,  
    req.body.description,  
    req.body.price,  
    req.body.attributes  
      ? JSON.parse(req.body.attributes)  
      : null,  
    delivery,  
    contact,  
    req.body.location_state,  
    req.body.location_city,  
    id,  
  ]  
);  

/* OPTIONAL: REPLACE IMAGES */  
if (req.files?.length) {  
  await client.query(  
    "DELETE FROM product_images WHERE product_id=$1",  
    [id]  
  );  

  const uploads = await Promise.all(  
    req.files.map((file, index) =>  
      new Promise((resolve, reject) => {  
        const stream = cloudinary.uploader.upload_stream(  
          { folder: "products" },  
          (err, result) => {  
            if (err) return reject(err);  
            resolve({  
              url: result.secure_url,  
              position: index,  
            });  
          }  
        );  
        stream.end(file.buffer);  
      })  
    )  
  );  

  for (const img of uploads) {  
    await client.query(  
      `  
      INSERT INTO product_images (product_id, image_url, position)  
      VALUES ($1,$2,$3)  
      `,  
      [id, img.url, img.position]  
    );  
  }  
}  

await client.query("COMMIT");  

res.json({ message: "Product updated" });

} catch (err) {
await client.query("ROLLBACK");
console.error(err);
res.status(500).json({ message: "Update failed" });
} finally {
client.release();
}
});

/* =========================================================
DELETE PRODUCT
========================================================= */
router.delete("/products/:id", async (req, res) => {
try {
const { id } = req.params;

await pool.query(  
  "DELETE FROM product_images WHERE product_id=$1",  
  [id]  
);  

await pool.query("DELETE FROM products WHERE id=$1", [id]);  

res.json({ message: "Deleted successfully" });

} catch (err) {
console.error(err);
res.status(500).json({ message: "Delete failed" });
}
});

/* =========================================================
GET CATEGORIES (UI DROPDOWNS)
========================================================= */
router.get("/categories", async (req, res) => {
try {
const { rows } = await pool.query(  SELECT id, name, parent_id, fields_key   FROM categories   ORDER BY name ASC  );

const map = {};  
const tree = [];  

rows.forEach((cat) => {  
  const key = cat.fields_key || "";  

  map[cat.id] = {  
    ...cat,  
    dynamicOptions: {  
      fields: categoryFields[key] || [],  
      brands: brands[key] || [],  
      models: models[key] || {},  
      colors: colors[key] || [],  
      conditions,  
      usedDetails,  
      ram: ramOptions,  
      storage: storageOptions,  
      sims,  
      features: featuresByCategory[key] || [],  
      years,  
      engines,  
      fuel_types: fuelTypes,  
      location: Object.keys(locationsByState),  
    },  
    subcategories: [],  
  };  

  if (!cat.parent_id) tree.push(map[cat.id]);  
});  

rows.forEach((cat) => {  
  if (cat.parent_id && map[cat.parent_id]) {  
    map[cat.parent_id].subcategories.push(map[cat.id]);  
  }  
});  

res.json(tree);

} catch (err) {
console.error(err);
res.status(500).json({ message: "Failed to fetch categories" });
}
});

export default router;