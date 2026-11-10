import type { Request } from "express";

export interface RegisterInput {
  full_name: string;
  username?: string;
  email: string;
  phone_number?: string;
  password: string;
}

export interface LoginInput {
  emailOrUsername: string;
  password: string;
}

export interface AuthenticatedUser {
  id: string;
  full_name: string;
  username: string | null;
  email: string;
  status: string;
  roles: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtAccessPayload {
  sub: string;
  type: "access";
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
