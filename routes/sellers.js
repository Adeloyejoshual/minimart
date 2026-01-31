const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { MongoClient, ObjectId } = require("mongodb");

const mongoClient = new MongoClient(process.env.MONGO_URI);
let mongoDB;

// Connect to MongoDB once
mongoClient.connect().then(client => {
  mongoDB = client.db(process.env.MONGO_DB_NAME);
  console.log("✅ Connected to MongoDB");
});

// Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require("../serviceAccountKey.json"))
  });
}

// GET /api/sellers?search=&page=&limit=
router.get("/", async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // 1️⃣ Firebase sellers
    const usersRef = admin.firestore().collection("users");
    let firebaseQuery = usersRef.where("role", "==", "seller");

    if (search) {
      // Firestore search on name (basic)
      firebaseQuery = firebaseQuery
        .orderBy("name")
        .startAt(search)
        .endAt(search + "\uf8ff");
    }

    const firebaseSnapshot = await firebaseQuery.get();
    const firebaseSellers = firebaseSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      source: "firebase"
    }));

    // 2️⃣ MongoDB sellers
    const mongoQuery = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    const mongoSellers = await mongoDB
      .collection("sellers")
      .find(mongoQuery)
      .skip(skip)
      .limit(Number(limit))
      .toArray();

    const sellersWithSource = mongoSellers.map(s => ({ ...s, source: "mongo" }));

    // 3️⃣ Combine and paginate manually
    const allSellers = [...firebaseSellers, ...sellersWithSource];

    res.json({
      total: allSellers.length,
      sellers: allSellers.slice(0, Number(limit))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch sellers" });
  }
});

module.exports = router;