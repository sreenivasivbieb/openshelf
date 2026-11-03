import { describe, expect, it } from "vitest";
import { connectDatabase, runMigrations } from "../../bootstrap/database";

function migratedDb() {
  const db = connectDatabase(":memory:");
  runMigrations(db);
  db.prepare(`INSERT INTO merchants (id, name, created_at) VALUES ('m_1', 'Demo', 'now')`).run();
  return db;
}

describe("schema (NFR-03)", () => {
  it("applies migrations once, in order", () => {
    const db = connectDatabase(":memory:");
    expect(runMigrations(db)).toEqual([
      "001_init.sql",
      "002_search_index_and_telemetry_errors.sql",
      "003_agent_keys.sql",
    ]);
    expect(runMigrations(db)).toEqual([]);
  });

  it("refuses to update or delete a quote", () => {
    const db = migratedDb();
    db.prepare(
      `INSERT INTO quotes (id, merchant_id, sku, quantity, unit_price_minor, total_minor, currency,
        shipping_days, return_days, guardrails_json, created_at, expires_at, quote_hash)
       VALUES ('q_1', 'm_1', 'MUG-014', 1, 3600, 3600, 'USD', 3, 30, '{}', 'now', 'later', 'h')`,
    ).run();
    expect(() => db.prepare(`UPDATE quotes SET total_minor = 1 WHERE id = 'q_1'`).run()).toThrow(
      /insert-only/,
    );
    expect(() => db.prepare(`DELETE FROM quotes WHERE id = 'q_1'`).run()).toThrow(/insert-only/);
  });
});

describe("search index (migration 002)", () => {
  const insert = `INSERT INTO products (merchant_id, sku, name, description_raw, description_agent, category,
    price_minor, stock, shipping_days, return_days, updated_at) VALUES ('m_1', ?, ?, '', ?, 'Kitchen', 100, 5, 2, 7, 'now')`;
  const match = (db: ReturnType<typeof migratedDb>, term: string) =>
    db.prepare(`SELECT sku FROM products_fts WHERE products_fts MATCH ?`).pluck().all(`"${term}"`);

  it("follows inserts, text updates and deletes, and stems words", () => {
    const db = migratedDb();
    db.prepare(insert).run("MUG-1", "Ceramic mug", "Glazed mugs");
    expect(match(db, "mugs")).toEqual(["MUG-1"]);

    db.prepare(
      `UPDATE products SET name = 'Teapot', description_agent = 'Cast iron' WHERE sku = 'MUG-1'`,
    ).run();
    expect(match(db, "mug")).toEqual([]);
    expect(match(db, "teapot")).toEqual(["MUG-1"]);

    db.prepare(`DELETE FROM products WHERE sku = 'MUG-1'`).run();
    expect(match(db, "teapot")).toEqual([]);
  });

  it("leaves the index alone when only stock changes", () => {
    const db = migratedDb();
    db.prepare(insert).run("MUG-1", "Ceramic mug", "Glazed");
    const rowid = () => db.prepare(`SELECT rowid FROM products_fts`).pluck().get();
    const before = rowid();
    db.prepare(`UPDATE products SET stock = 0 WHERE sku = 'MUG-1'`).run();
    expect(rowid()).toBe(before);
  });
});
