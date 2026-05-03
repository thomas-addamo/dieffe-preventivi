import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client";
import path from "path";

const migrationsFolder = path.join(
  process.cwd(),
  "src",
  "lib",
  "db",
  "migrations"
);

migrate(db, { migrationsFolder });
console.log("Database migrated successfully");
