import Database from "better-sqlite3";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Db } from "../src/repositories/db";

export const MIGRATIONS_DIR = join(import.meta.dirname, "..", "database", "migrations");

/** Opens SQLite with the pragmas the app relies on. ":memory:" for tests. */
export function connectDatabase(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL"); // dashboard reads while agents write
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}

/** Applies database/migrations/*.sql in name order, each once, each in a transaction. */
export function runMigrations(db: Db, dir = MIGRATIONS_DIR): string[] {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`,
  );
  const applied = new Set(
    db.prepare(`SELECT name FROM schema_migrations`).pluck().all() as string[],
  );
  const pending = readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && !applied.has(f))
    .sort();

  for (const name of pending) {
    const sql = readFileSync(join(dir, name), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.prepare(`INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)`).run(
        name,
        new Date().toISOString(),
      );
    })();
  }
  return pending;
}
