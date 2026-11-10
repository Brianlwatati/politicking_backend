import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

// API prefix configuration.
// Example: /api/v1/auth/login
const apiprefix = process.env.API_PREFIX || "/api/v1";

export const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);

// Request parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// HTTP request logging
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

app.use(apiprefix, apiLimiter);

// Root endpoint
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Politikings API is running.",
    version: "1.0.0",
  });
});

// Health check endpoint
app.get(`${apiprefix}/health`, (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Politikings API is healthy.",
    timestamp: new Date().toISOString(),
  });
});
