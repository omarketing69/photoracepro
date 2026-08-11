import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NEW_DATABASE_URL || "postgresql://postgres:password@localhost:5432/racephoto?sslmode=disable",
  },
});
