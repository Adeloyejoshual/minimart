// middleware/auth.js - ✅ DEFAULT EXPORT
import jwt from 'jsonwebtoken';

const auth = (req, res, next) => {
  try {
    // Demo token - replace with real JWT in production
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided - Access denied' 
      });
    }

    // Demo verification (replace with real secret)
    const decoded = jwt.verify(token, 'marketplace_demo_secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token' 
    });
  }
};

export default auth;