// cron/analyticsReset.js - Daily views reset
import cron from 'node-cron';
import MarketplaceProduct from '../models/MarketplaceProduct.js';

cron.schedule('0 0 * * *', async () => {
  await MarketplaceProduct.updateMany({ active: true }, { views_today: 0 });
});
