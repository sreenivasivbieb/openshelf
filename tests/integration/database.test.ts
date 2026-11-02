import { describe, expect, it } from "vitest";
import { connectDatabase, runMigrations } from "../../bootstrap/database";

function migratedDb() {
  const db = connectDatabase(":memory:");
  runMigrations(db);
  db.prepare(`INSERT INTO merchants (id, name, created_at) VALUES ('m_1', 'Demo', 'now')`).run();
  db.prepare(
    `INSERT INTO quotes (id, merchant_id, sku, quantity, unit_price_minor, total_minor, currency,
      shipping_days, return_days, guardrails_json, created_at, expires_at, quote_hash)
     VALUES ('q_1', 'm_1', 'MUG-014', 1, 3600, 3600, 'USD', 3, 30, '{}', 'now', 'later', 'h')`,
  ).run();
  return db;
}

describe("schema (NFR-03)", () => {
  it("applies migrations once", () => {
    const db = connectDatabase(":memory:");
    expect(runMigrations(db)).toEqual(["001_init.sql"]);
    expect(runMigrations(db)).toEqual([]);
  });

  it("refuses to update or delete a quote", () => {
    const db = migratedDb();
    expect(() => db.prepare(`UPDATE quotes SET total_minor = 1 WHERE id = 'q_1'`).run()).toThrow(
      /insert-only/,
    );
    expect(() => db.prepare(`DELETE FROM quotes WHERE id = 'q_1'`).run()).toThrow(/insert-only/);
  });
});
