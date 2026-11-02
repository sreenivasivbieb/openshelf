# database/

- `migrations/` — plain SQL, applied in name order by `pnpm db:migrate` (and on server start).
  Never edit an applied migration; add `002_*.sql`.
- `seeds/demo-merchant.csv` — the fixed demo catalog: messy headers (to exercise column mapping),
  one product with no rating, one out of stock, and `CANDLE-3` with planted injection text.

The database file itself lives in `storage/` (git-ignored). Design: `docs/architecture/data-model.md`.
