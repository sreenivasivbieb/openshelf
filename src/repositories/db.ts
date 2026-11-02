import type Database from "better-sqlite3";

/** Connection type. The connection itself is opened in bootstrap/database.ts. */
export type Db = Database.Database;

/** Runs fn inside one SQLite transaction (all-or-nothing). Services use it for multi-table writes. */
export type RunInTransaction = <T>(fn: () => T) => T;

export function createTransactionRunner(db: Db): RunInTransaction {
  return (fn) => db.transaction(fn)();
}
