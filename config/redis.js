// config/redis.js
import Redis from "ioredis";

const redisConfig = {
  host: "redis-11056.crce275.eu-west3-1.gcp.cloud.redislabs.com",
  port: 11056,
  password: process.env.REDIS_PASSWORD,
  tls: {}, // required for Redis Cloud
};

// Publisher (for sending events)
export const pub = new Redis(redisConfig);

// Subscriber (for listening to events)
export const sub = new Redis(redisConfig);

// Optional: general purpose client (caching, presence, etc.)
export const redis = new Redis(redisConfig);

// Logs
pub.on("connect", () => console.log("Redis pub connected"));
sub.on("connect", () => console.log("Redis sub connected"));

pub.on("error", (err) => console.error("Redis pub error", err));
sub.on("error", (err) => console.error("Redis sub error", err));