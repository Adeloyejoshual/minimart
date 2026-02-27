// middleware/geo.js - Auto-detect country & enhance seller
import axios from 'axios';

export const autoGeo = async (req, res, next) => {
  try {
    // ✅ IP Country Detection (free API)
    const geoResponse = await axios.get('http://ip-api.com/json', {
      params: { fields: 'countryCode,country,city,regionName' }
    });
    
    req.geo = {
      country: geoResponse.data.countryCode || 'NG',
      countryName: geoResponse.data.country || 'Nigeria',
      city: geoResponse.data.city || '',
      state: geoResponse.data.regionName || ''
    };
  } catch (error) {
    req.geo = { country: 'NG', countryName: 'Nigeria', city: '', state: '' };
  }
  
  next();
};

// ✅ Enhanced auth with seller name fallback
export const authWithSeller = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, 'marketplace_demo_secret');
      req.auth = decoded;
      
      // ✅ REAL SELLER NAME from JWT
      req.sellerInfo = {
        name: decoded.name || decoded.username || 'Anonymous Seller',
        email: decoded.email,
        userId: decoded.sub || decoded.id
      };
    } else {
      req.sellerInfo = { name: 'Anonymous Seller', email: '', userId: null };
    }
    
    next();
  } catch (error) {
    req.sellerInfo = { name: 'Anonymous Seller', email: '', userId: null };
    next();
  }
};