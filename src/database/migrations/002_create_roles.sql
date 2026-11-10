-- Migration: 002_create_roles.sql
-- Purpose: Define platform roles and assign one or more roles to users.
-- Depends on: 001_create_users.sql
-- PostgreSQL

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,

    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_roles_name UNIQUE (name),
    CONSTRAINT uq_roles_slug UNIQUE (slug)
);

CREATE INDEX idx_roles_active ON roles(is_active);

-- Junction table: a user can have multiple roles, and a role can belong to many users.
CREATE TABLE user_roles (
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID,

    CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role_id),

    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,

    CONSTRAINT fk_user_roles_assigned_by
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_user_roles_assigned_by ON user_roles(assigned_by);

-- Initial system roles.
INSERT INTO roles (name, slug, description, is_system)
VALUES
    ('Super Administrator', 'super_admin', 'Full access to all platform functions.', TRUE),
    ('Administrator', 'admin', 'Manages platform operations and users.', TRUE),
    ('Editor', 'editor', 'Creates, reviews, edits, and publishes editorial content.', TRUE),
    ('Moderator', 'moderator', 'Reviews and moderates user-generated content.', TRUE),
    ('Journalist', 'journalist', 'Creates and submits news articles for review.', TRUE),
    ('Registered User', 'registered_user', 'Can participate in permitted platform interactions.', TRUE)
ON CONFLICT (slug) DO NOTHING;
