// middleware/geo.js - Auto-detect country
import axios from 'axios';

export const detectCountry = async (req, res, next) => {
  try {
    const response = await axios.get('http://ip-api.com/json', {
      params: { fields: 'countryCode,country' }
    });
    
    req.geo = {
      country: response.data.countryCode || 'NG',
      countryName: response.data.country || 'Nigeria'
    };
  } catch (error) {
    req.geo = { country: 'NG', countryName: 'Nigeria' }; // Fallback
  }
  
  next();
};