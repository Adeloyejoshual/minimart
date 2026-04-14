import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});