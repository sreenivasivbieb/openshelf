import { loadEnv } from "../bootstrap/env";
import { connectDatabase, runMigrations } from "../bootstrap/database";

const env = loadEnv();
const applied = runMigrations(connectDatabase(env.DATABASE_PATH));
console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date.");
