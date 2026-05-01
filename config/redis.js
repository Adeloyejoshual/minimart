import Redis from "ioredis";

const redis = new Redis({
  host: "redis-11056.crce275.eu-west3-1.gcp.cloud.redislabs.com",
  port: 11056,
  password: process.env.REDIS_PASSWORD, // IMPORTANT
  tls: {}, // required for Redis Cloud
});

redis.on("connect", () => console.log("Redis connected"));
redis.on("error", (err) => console.error("Redis error", err));

export default redis;