const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for CockroachDB / Render
  max:             10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => console.error("PG Pool error:", err));

/**
 * Tagged-template helper for safe parameterised queries
 * Usage: await query`SELECT * FROM users WHERE id = ${userId}`
 */
async function query(strings, ...values) {
  // Support both tagged-template and (text, params) calling styles
  if (typeof strings === "string") {
    const client = await pool.connect();
    try {
      return await client.query(strings, values[0] ?? []);
    } finally {
      client.release();
    }
  }
  // Tagged template
  let text = "";
  const params = [];
  strings.forEach((s, i) => {
    text += s;
    if (i < values.length) {
      params.push(values[i]);
      text += `$${params.length}`;
    }
  });
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

module.exports = { pool, query };