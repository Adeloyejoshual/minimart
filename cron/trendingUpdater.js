// cron/trendingUpdater.js
const cron = require('node-cron');
const mongoose = require('mongoose');
const MarketplaceProduct = require('../models/MarketplaceProduct');

cron.schedule('0 */6 * * *', async () => {
  console.log('🧹 Updating trending scores...');
  const products = await MarketplaceProduct.find({ active: true, status: 'active' });
  for (const product of products) {
    product.updateTrendingScore();
    await product.save();
  }
  console.log(`✅ Updated ${products.length} trending scores`);
});
