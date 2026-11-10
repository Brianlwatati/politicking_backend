import type { RequestHandler } from "express";
import { z } from "zod";

export const registerSchema = z.object({
  full_name: z.string().trim().min(2).max(200),

  username: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_.]+$/)
    .optional(),

  email: z.string().trim().email().max(255),

  phone_number: z.string().trim().max(30).optional(),

  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  emailOrUsername: z.string().trim().min(1),

  password: z.string().min(1).max(72),
});

export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });

      return;
    }

    req.body = result.data;

    next();
  };
}
