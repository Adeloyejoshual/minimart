// middleware/redisCache.js
import redis from 'redis';
const client = redis.createClient();

export const cache = (duration = 300) => async (req, res, next) => {
  const key = `marketplace:${req.originalUrl}`;
  const cached = await client.get(key);
  if (cached) return res.json(JSON.parse(cached));
  
  res.sendResponse = res.json;
  res.json = async body => {
    await client.setex(key, duration, JSON.stringify(body));
    res.sendResponse(body);
  };
  next();
};
