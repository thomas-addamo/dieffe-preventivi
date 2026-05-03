import { defineConfig } from "drizzle-kit";
import path from "path";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: path.join(process.cwd(), "storage", "database.sqlite"),
  },
});
