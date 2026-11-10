import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { PoolClient } from "pg";

import { pool } from "../../config/database.js";

import type {
  AuthenticatedUser,
  LoginInput,
  RegisterInput,
  TokenPair,
} from "./auth.types.js";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const REFRESH_TOKEN_DAYS = 7;

const SALT_ROUNDS = 12;

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function getAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_ACCESS_SECRET must be configured with at least 32 characters.",
    );
  }

  return secret;
}

function getRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_REFRESH_SECRET must be configured with at least 32 characters.",
    );
  }

  return secret;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createAccessToken(userId: string): string {
  return jwt.sign({ type: "access" }, getAccessSecret(), {
    subject: userId,
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

function createRefreshToken(userId: string, tokenId: string): string {
  return jwt.sign({ type: "refresh" }, getRefreshSecret(), {
    subject: userId,
    jwtid: tokenId,
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

async function issueTokenPair(
  client: PoolClient,
  userId: string,
): Promise<TokenPair> {
  const tokenId = randomUUID();

  const refreshToken = createRefreshToken(userId, tokenId);

  const tokenHash = hashToken(refreshToken);

  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  );

  await client.query(
    `
      INSERT INTO refresh_tokens (
        id,
        user_id,
        token_hash,
        expires_at
      )
      VALUES ($1, $2, $3, $4)
    `,
    [tokenId, userId, tokenHash, expiresAt],
  );

  return {
    accessToken: createAccessToken(userId),
    refreshToken,
  };
}

async function getUserById(userId: string): Promise<AuthenticatedUser | null> {
  const result = await pool.query(
    `
      SELECT
        u.id,
        u.full_name,
        u.username,
        u.email,
        u.status,
        COALESCE(
          ARRAY_AGG(r.slug)
            FILTER (WHERE r.id IS NOT NULL),
          ARRAY[]::VARCHAR[]
        ) AS roles
      FROM users u
      LEFT JOIN user_roles ur
        ON ur.user_id = u.id
      LEFT JOIN roles r
        ON r.id = ur.role_id
        AND r.is_active = TRUE
      WHERE u.id = $1
      GROUP BY u.id
    `,
    [userId],
  );

  return result.rows[0] ?? null;
}

// REGISTER
export async function registerUser(input: RegisterInput) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const userResult = await client.query(
      `
        INSERT INTO users (
          full_name,
          username,
          email,
          phone_number,
          password_hash,
          status
        )
        VALUES ($1, $2, $3, $4, $5, 'active')
        RETURNING
          id,
          full_name,
          username,
          email,
          status
      `,
      [
        input.full_name,
        input.username ?? null,
        input.email.toLowerCase(),
        input.phone_number ?? null,
        passwordHash,
      ],
    );

    const user = userResult.rows[0];

    // Every public registration receives only
    // the ordinary registered_user role.
    const roleResult = await client.query(
      `
        SELECT id
        FROM roles
        WHERE slug = 'registered_user'
          AND is_active = TRUE
        LIMIT 1
      `,
    );

    if (roleResult.rowCount === 0) {
      throw new Error("The registered_user role has not been configured.");
    }

    await client.query(
      `
        INSERT INTO user_roles (
          user_id,
          role_id
        )
        VALUES ($1, $2)
      `,
      [user.id, roleResult.rows[0].id],
    );

    const tokens = await issueTokenPair(client, user.id);

    await client.query("COMMIT");

    return {
      user: {
        ...user,
        roles: ["registered_user"],
      },
      tokens,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    // PostgreSQL unique violation.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AuthError("Email or username is already registered.", 409);
    }

    throw error;
  } finally {
    client.release();
  }
}

// LOGIN
export async function loginUser(input: LoginInput) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT
          id,
          full_name,
          username,
          email,
          password_hash,
          status
        FROM users
        WHERE LOWER(email) = LOWER($1)
           OR LOWER(username) = LOWER($1)
        LIMIT 1
        FOR UPDATE
      `,
      [input.emailOrUsername],
    );

    if (result.rowCount === 0) {
      throw new AuthError("Invalid email/username or password.", 401);
    }

    const user = result.rows[0];

    const passwordMatches = await bcrypt.compare(
      input.password,
      user.password_hash,
    );

    if (!passwordMatches) {
      throw new AuthError("Invalid email/username or password.", 401);
    }

    if (user.status !== "active") {
      throw new AuthError(
        "Your account is not active. Please contact support.",
        403,
      );
    }

    await client.query(
      `
        UPDATE users
        SET last_login_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [user.id],
    );

    const tokens = await issueTokenPair(client, user.id);

    const rolesResult = await client.query(
      `
        SELECT r.slug
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = $1
          AND r.is_active = TRUE
      `,
      [user.id],
    );

    await client.query("COMMIT");

    return {
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        email: user.email,
        status: user.status,
        roles: rolesResult.rows.map((role) => role.slug),
      },
      tokens,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// REFRESH TOKEN
export async function refreshUserToken(refreshToken: string) {
  let payload: jwt.JwtPayload;

  try {
    const decoded = jwt.verify(refreshToken, getRefreshSecret());

    if (
      typeof decoded === "string" ||
      decoded.type !== "refresh" ||
      !decoded.sub ||
      !decoded.jti
    ) {
      throw new Error("Invalid refresh token.");
    }

    payload = decoded;
  } catch {
    throw new AuthError("Invalid or expired refresh token.", 401);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tokenHash = hashToken(refreshToken);

    const result = await client.query(
      `
        SELECT
          rt.id,
          rt.user_id,
          rt.expires_at,
          rt.revoked_at,
          u.status
        FROM refresh_tokens rt
        JOIN users u ON u.id = rt.user_id
        WHERE rt.token_hash = $1
        FOR UPDATE OF rt
      `,
      [tokenHash],
    );

    if (result.rowCount === 0) {
      throw new AuthError("Refresh token is no longer valid.", 401);
    }

    const storedToken = result.rows[0];

    if (
      storedToken.id !== payload.jti ||
      storedToken.user_id !== payload.sub ||
      storedToken.revoked_at ||
      new Date(storedToken.expires_at) <= new Date()
    ) {
      throw new AuthError("Refresh token has expired or been revoked.", 401);
    }

    if (storedToken.status !== "active") {
      throw new AuthError("Your account is not active.", 403);
    }

    // Revoke the old token before issuing another.
    await client.query(
      `
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE id = $1
      `,
      [storedToken.id],
    );

    const tokens = await issueTokenPair(client, storedToken.user_id);

    await client.query("COMMIT");

    return tokens;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// LOGOUT
export async function logoutUser(
  refreshToken: string | undefined,
): Promise<void> {
  if (!refreshToken) {
    return;
  }

  await pool.query(
    `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE token_hash = $1
        AND revoked_at IS NULL
    `,
    [hashToken(refreshToken)],
  );
}

// CURRENT USER
export async function getCurrentUser(
  userId: string,
): Promise<AuthenticatedUser> {
  const user = await getUserById(userId);

  if (!user || user.status !== "active") {
    throw new AuthError("User account is unavailable.", 401);
  }

  return user;
}
