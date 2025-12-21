"use strict";

require("dotenv").config();
const { Pool } = require("pg");

const useSSL = String(process.env.DB_SSL || "").toLowerCase() === "true";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  console.error("[PG POOL ERROR]", err);
});

module.exports = pool;