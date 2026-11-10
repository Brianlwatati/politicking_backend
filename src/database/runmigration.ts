import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { pool } from "../config/database.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

const migrationsDirectory = path.join(currentDirectory, "migrations");

// A fixed PostgreSQL advisory lock prevents two migration
// processes from running simultaneously.
const MIGRATION_LOCK_ID = 82420261110;

interface Migration {
  filename: string;
  sql: string;
  checksum: string;
}

async function createMigrationTable(client: any): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getMigrationFiles(): Promise<string[]> {
  const files = await readdir(migrationsDirectory);

  return files
    .filter((file) => /^\d+_.*\.sql$/.test(file))
    .sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
      }),
    );
}

async function loadMigration(filename: string): Promise<Migration> {
  const filePath = path.join(migrationsDirectory, filename);

  const sql = await readFile(filePath, "utf-8");

  const checksum = createHash("sha256").update(sql).digest("hex");

  return {
    filename,
    sql,
    checksum,
  };
}

async function runMigrations(): Promise<void> {
  const client = await pool.connect();

  let lockAcquired = false;

  try {
    console.log("Starting database migrations...");

    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);

    lockAcquired = true;

    await createMigrationTable(client);

    const migrationFiles = await getMigrationFiles();

    if (migrationFiles.length === 0) {
      console.log("No migration files found.");
      return;
    }

    const appliedResult = await client.query<{
      filename: string;
      checksum: string;
    }>(`
      SELECT filename, checksum
      FROM schema_migrations
    `);

    const appliedMigrations = new Map(
      appliedResult.rows.map((row) => [row.filename, row.checksum]),
    );

    let executedCount = 0;

    for (const filename of migrationFiles) {
      const migration = await loadMigration(filename);

      const existingChecksum = appliedMigrations.get(filename);

      if (existingChecksum) {
        if (existingChecksum !== migration.checksum) {
          throw new Error(
            `Migration ${filename} has changed after being applied. ` +
              "Create a new migration instead of editing an applied file.",
          );
        }

        console.log(`Already applied: ${filename}`);
        continue;
      }

      console.log(`Applying: ${filename}`);

      await client.query("BEGIN");

      try {
        await client.query(migration.sql);

        await client.query(
          `
            INSERT INTO schema_migrations (
              filename,
              checksum
            )
            VALUES ($1, $2)
          `,
          [migration.filename, migration.checksum],
        );

        await client.query("COMMIT");

        console.log(`Successfully applied: ${filename}`);

        executedCount++;
      } catch (error) {
        await client.query("ROLLBACK");

        console.error(`Failed migration: ${filename}`);

        throw error;
      }
    }

    console.log("--------------------------------");
    console.log("Migration process completed.");
    console.log(`New migrations applied: ${executedCount}`);
    console.log("--------------------------------");
  } finally {
    if (lockAcquired) {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]);
    }

    client.release();
  }
}

runMigrations()
  .catch((error: unknown) => {
    console.error("Migration process failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
