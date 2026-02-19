// middleware/viewTracker.js - Auto trending updates
import MarketplaceProduct from '../models/MarketplaceProduct.js';

export const trackView = async (req, res, next) => {
  if (req.path.includes('/increment-view')) return next();
  
  const productId = req.params.id || req.query.id;
  if (productId) {
    try {
      const product = await MarketplaceProduct.findById(productId);
      if (product?.active && product.status === 'active') {
        product.views_total += 1;
        product.views_today += 1;
        product.live_viewers = Math.floor(Math.random() * 20) + 3;
        product.updateTrendingScore();
        await product.save();
      }
    } catch (err) {
      console.error('View tracking failed:', err);
    }
  }
  next();
};
