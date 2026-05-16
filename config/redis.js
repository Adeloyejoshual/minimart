// config/redis.js
import Redis from "ioredis";

const redisUrl = `rediss://:${process.env.REDIS_PASSWORD}@redis-11056.crce275.eu-west3-1.gcp.cloud.redislabs.com:11056`;

export const pub = new Redis(redisUrl);
export const sub = new Redis(redisUrl);
export const redis = new Redis(redisUrl);

pub.on("connect", () => console.log("Redis pub connected"));
sub.on("connect", () => console.log("Redis sub connected"));

pub.on("error", (err) => console.error("Redis pub error", err));
sub.on("error", (err) => console.error("Redis sub error", err));