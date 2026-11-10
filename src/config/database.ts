import "dotenv/config";
import { Pool } from "pg";

// Ensure the database connection string is configured.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in environment variables.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Enable SSL when DB_SSL=true.
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  // Connection pool configuration.
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Handle unexpected PostgreSQL pool errors.
pool.on("error", (error: Error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});
