import dotenv from "dotenv";
dotenv.config();

import { app } from "./app.js";
import { pool } from "./config/database.js";

const PORT = Number(process.env.PORT) || 5000;

const startServer = async () => {
  try {
    await pool.query("SELECT 1");
    console.log("PostgreSQL connected successfully");
    app.listen(PORT, () => {
      console.log(`Kenya Politics API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
