-- 002: search index keyed by (merchant_id, sku) with stemming; error codes in telemetry.
--
-- Why: 001 linked products_fts to products through the implicit rowid. products has a composite
-- primary key, so its rowid is not guaranteed stable (VACUUM may renumber it), which would silently
-- desync the index. Keying the index by (merchant_id, sku) removes that risk. The porter stemmer
-- lets "mugs" find "mug".

DROP TRIGGER products_fts_ai;
DROP TRIGGER products_fts_ad;
DROP TRIGGER products_fts_au;
DROP TABLE products_fts;

CREATE VIRTUAL TABLE products_fts USING fts5(
  merchant_id UNINDEXED,
  sku UNINDEXED,
  name,
  description_agent,
  category,
  tokenize = 'porter unicode61 remove_diacritics 2'
);

INSERT INTO products_fts (merchant_id, sku, name, description_agent, category)
SELECT merchant_id, sku, name, description_agent, category FROM products;

CREATE TRIGGER products_fts_ai AFTER INSERT ON products BEGIN
  INSERT INTO products_fts (merchant_id, sku, name, description_agent, category)
  VALUES (new.merchant_id, new.sku, new.name, new.description_agent, new.category);
END;

CREATE TRIGGER products_fts_ad AFTER DELETE ON products BEGIN
  DELETE FROM products_fts WHERE merchant_id = old.merchant_id AND sku = old.sku;
END;

-- Only text changes touch the index; stock updates at capture do not.
CREATE TRIGGER products_fts_au
AFTER UPDATE OF merchant_id, sku, name, description_agent, category ON products BEGIN
  DELETE FROM products_fts WHERE merchant_id = old.merchant_id AND sku = old.sku;
  INSERT INTO products_fts (merchant_id, sku, name, description_agent, category)
  VALUES (new.merchant_id, new.sku, new.name, new.description_agent, new.category);
END;

-- AppError code (INVALID_INPUT, MERCHANT_NOT_FOUND, ...) when outcome = 'error'.
ALTER TABLE telemetry ADD COLUMN error_code TEXT;
