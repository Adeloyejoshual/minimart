// middleware/geo.js
import axios from "axios";
import jwt from "jsonwebtoken";

// ---------------- Geo-location Middleware ----------------
export const autoGeo = async (req, res, next) => {
  try {
    // Detect country/city/state from IP
    const geoResponse = await axios.get("http://ip-api.com/json", {
      params: { fields: "countryCode,country,city,regionName" },
    });

    const { countryCode, country, city, regionName } = geoResponse.data;

    req.geo = {
      country: countryCode || "NG",
      countryName: country || "Nigeria",
      city: city || "",
      state: regionName || "",
    };
  } catch (error) {
    console.error("Geo detection failed:", error.message);
    req.geo = {
      country: "NG",
      countryName: "Nigeria",
      city: "",
      state: "",
    };
  }

  next();
};

// ---------------- Auth & Seller Info Middleware ----------------
export const authWithSeller = (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (token) {
      // Replace this secret with your env JWT_SECRET in production
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "marketplace_demo_secret");

      req.auth = decoded;

      req.sellerInfo = {
        name: decoded.name || decoded.username || "Anonymous Seller",
        email: decoded.email || "",
        userId: decoded.sub || decoded.id || null,
      };
    } else {
      // Guest / anonymous seller
      req.sellerInfo = { name: "Anonymous Seller", email: "", userId: null };
    }

    next();
  } catch (error) {
    console.error("Auth seller middleware error:", error.message);
    req.sellerInfo = { name: "Anonymous Seller", email: "", userId: null };
    next();
  }
};