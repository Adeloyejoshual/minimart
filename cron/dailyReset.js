// cron/dailyReset.js - Views reset + trending batch update
import cron from 'node-cron';
import MarketplaceProduct from '../models/MarketplaceProduct.js';

cron.schedule('0 0 * * *', async () => {
  await MarketplaceProduct.updateMany({}, { views_today: 0 });
  
  const activeProducts = await MarketplaceProduct.find({ active: true, status: 'active' });
  for (const product of activeProducts) {
    product.updateTrendingScore();
    await product.save();
  }
});
