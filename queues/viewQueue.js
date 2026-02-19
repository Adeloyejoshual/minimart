// queues/viewQueue.js - BullMQ Async Processing
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import MarketplaceProduct from '../models/MarketplaceProduct.js';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
});

export const viewQueue = new Queue('productViews', { connection });
export const viewWorker = new Worker('productViews', async job => {
  const { productId } = job.data;
  const product = await MarketplaceProduct.findById(productId);
  if (product?.active && product.status === 'active') {
    product.views_total += 1;
    product.views_today += 1;
    product.live_viewers = Math.floor(Math.random() * 20) + 3;
    product.updateTrendingScore();
    await product.save();
  }
}, { connection });
