// middleware/redisCache.js - Enterprise Redis Caching
import IORedis from 'ioredis';

const redis = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

export const cacheMiddleware = (duration = 300) => async (req, res, next) => {
  const cacheKey = `marketplace:${req.originalUrl}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    res.sendResponse = res.json;
    res.json = async (body) => {
      await redis.setex(cacheKey, duration, JSON.stringify(body));
      res.sendResponse(body);
    };
    next();
  } catch (error) {
    next();
  }
};
