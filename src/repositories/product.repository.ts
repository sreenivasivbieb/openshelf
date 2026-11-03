import type { Statement } from "better-sqlite3";
import type { Db } from "./db";
import type { Product } from "../domain/entities";
import type { FirewallStatus } from "../domain/enums";
import { toFtsQuery } from "./fts";

export interface ProductSearchFilters {
  query: string;
  maxPriceMinor?: number;
  maxShippingDays?: number;
  minRating?: number;
  inStockOnly: boolean;
  limit: number;
}

export interface ProductRepository {
  /** Re-upload semantics: the merchant's catalog becomes exactly `products`, in one transaction. */
  replaceCatalog(merchantId: string, products: Product[]): void;
  findBySku(merchantId: string, sku: string): Product | null;
  /** FTS5 bm25 over name + agent description + category; clean products only (FR-07, NFR-04). */
  search(merchantId: string, filters: ProductSearchFilters): Product[];
  listFlagged(merchantId: string): Product[];
  /**
   * Reserves stock at capture (NFR-05): one conditional UPDATE, so it can never go negative.
   * Returns false (and changes nothing) when the product is gone or has fewer than `qty` left.
   */
  decrementStock(merchantId: string, sku: string, qty: number): boolean;
  /** Gives reserved stock back when the capture fails (compensation for decrementStock). */
  restoreStock(merchantId: string, sku: string, qty: number): void;
  countByFirewallStatus(merchantId: string): { total: number; clean: number; flagged: number };
}

interface ProductRecord {
  merchant_id: string;
  sku: string;
  name: string;
  description_raw: string;
  description_agent: string | null;
  category: string | null;
  price_minor: number;
  stock: number;
  shipping_days: number;
  return_days: number;
  rating_avg: number | null;
  review_count: number | null;
  firewall_status: FirewallStatus;
  firewall_reason: string | null;
  updated_at: string;
}

function toProduct(r: ProductRecord): Product {
  return {
    merchantId: r.merchant_id,
    sku: r.sku,
    name: r.name,
    descriptionRaw: r.description_raw,
    descriptionAgent: r.description_agent,
    category: r.category,
    priceMinor: r.price_minor,
    stock: r.stock,
    shippingDays: r.shipping_days,
    returnDays: r.return_days,
    ratingAvg: r.rating_avg,
    reviewCount: r.review_count,
    firewallStatus: r.firewall_status,
    firewallReason: r.firewall_reason,
    updatedAt: r.updated_at,
  };
}

/** Tables: products, products_fts (kept in sync by triggers, migration 002). */
export function createProductRepository(db: Db): ProductRepository {
  const deleteCatalog = db.prepare(`DELETE FROM products WHERE merchant_id = ?`);
  const insert = db.prepare(
    `INSERT INTO products (merchant_id, sku, name, description_raw, description_agent, category,
       price_minor, stock, shipping_days, return_days, rating_avg, review_count,
       firewall_status, firewall_reason, updated_at)
     VALUES (@merchantId, @sku, @name, @descriptionRaw, @descriptionAgent, @category,
       @priceMinor, @stock, @shippingDays, @returnDays, @ratingAvg, @reviewCount,
       @firewallStatus, @firewallReason, @updatedAt)`,
  );
  const bySku = db.prepare(`SELECT * FROM products WHERE merchant_id = ? AND sku = ?`);
  const flagged = db.prepare(
    `SELECT * FROM products WHERE merchant_id = ? AND firewall_status = 'flagged' ORDER BY sku`,
  );
  const counts = db.prepare(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(firewall_status = 'clean'), 0) AS clean,
            COALESCE(SUM(firewall_status = 'flagged'), 0) AS flagged
     FROM products WHERE merchant_id = ?`,
  );
  const decrement = db.prepare(
    `UPDATE products SET stock = stock - @qty
     WHERE merchant_id = @merchantId AND sku = @sku AND stock >= @qty`,
  );
  const restore = db.prepare(
    `UPDATE products SET stock = stock + @qty WHERE merchant_id = @merchantId AND sku = @sku`,
  );
  const replace = db.transaction((merchantId: string, products: Product[]) => {
    deleteCatalog.run(merchantId);
    for (const product of products) insert.run(product);
  });

  // Search SQL is assembled from fixed fragments only (user text is always a bound parameter).
  const searchStatements = new Map<string, Statement>();
  const prepared = (sql: string) => {
    let statement = searchStatements.get(sql);
    if (!statement) searchStatements.set(sql, (statement = db.prepare(sql)));
    return statement;
  };

  return {
    replaceCatalog: (merchantId, products) => {
      if (products.some((p) => p.merchantId !== merchantId)) {
        throw new Error("replaceCatalog: every product must belong to the merchant being replaced");
      }
      replace(merchantId, products);
    },

    findBySku: (merchantId, sku) => {
      const record = bySku.get(merchantId, sku) as ProductRecord | undefined;
      return record ? toProduct(record) : null;
    },

    search: (merchantId, filters) => {
      const where = ["p.merchant_id = @merchantId", "p.firewall_status = 'clean'"];
      const params: Record<string, unknown> = { merchantId, limit: filters.limit };
      if (filters.maxPriceMinor !== undefined) {
        where.push("p.price_minor <= @maxPriceMinor");
        params.maxPriceMinor = filters.maxPriceMinor;
      }
      if (filters.maxShippingDays !== undefined) {
        where.push("p.shipping_days <= @maxShippingDays");
        params.maxShippingDays = filters.maxShippingDays;
      }
      if (filters.minRating !== undefined) {
        where.push("p.rating_avg >= @minRating"); // products without a rating never pass a rating filter
        params.minRating = filters.minRating;
      }
      if (filters.inStockOnly) where.push("p.stock > 0");

      const match = toFtsQuery(filters.query);
      let sql: string;
      if (match) {
        params.match = match;
        sql = `SELECT p.* FROM products_fts
               JOIN products p ON p.merchant_id = products_fts.merchant_id AND p.sku = products_fts.sku
               WHERE products_fts MATCH @match AND ${where.join(" AND ")}
               ORDER BY bm25(products_fts, 0, 0, 10.0, 2.0, 4.0), p.price_minor, p.sku
               LIMIT @limit`;
      } else {
        sql = `SELECT p.* FROM products p WHERE ${where.join(" AND ")} ORDER BY p.name, p.sku LIMIT @limit`;
      }
      return (prepared(sql).all(params) as ProductRecord[]).map(toProduct);
    },

    listFlagged: (merchantId) => (flagged.all(merchantId) as ProductRecord[]).map(toProduct),

    decrementStock: (merchantId, sku, qty) => {
      if (!Number.isSafeInteger(qty) || qty <= 0)
        throw new Error("decrementStock: qty must be > 0");
      return decrement.run({ merchantId, sku, qty }).changes === 1;
    },

    restoreStock: (merchantId, sku, qty) => {
      if (!Number.isSafeInteger(qty) || qty <= 0) throw new Error("restoreStock: qty must be > 0");
      restore.run({ merchantId, sku, qty });
    },

    countByFirewallStatus: (merchantId) =>
      counts.get(merchantId) as { total: number; clean: number; flagged: number },
  };
}
