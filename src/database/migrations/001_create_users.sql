-- Migration: 001_create_users.sql
-- Purpose: Store platform user accounts.
-- PostgreSQL

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    full_name VARCHAR(200) NOT NULL,
    username VARCHAR(50),
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(30),

    password_hash TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'active',
    email_verified_at TIMESTAMPTZ,
    phone_verified_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_users_status
        CHECK (status IN ('active', 'inactive', 'suspended', 'pending_verification'))
);

-- Email addresses are treated as case-insensitive.
CREATE UNIQUE INDEX uq_users_email_lower
    ON users (LOWER(email));

-- Username is optional, but when provided it must be unique (case-insensitive).
CREATE UNIQUE INDEX uq_users_username_lower
    ON users (LOWER(username))
    WHERE username IS NOT NULL;

CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
