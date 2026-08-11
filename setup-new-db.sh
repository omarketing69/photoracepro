#!/bin/bash

echo "🔧 Configurando nueva base de datos PostgreSQL local..."

# Crear nueva DATABASE_URL temporal para evitar el endpoint caído
export NEW_DATABASE_URL="postgresql://postgres:password@localhost:5432/racephoto?sslmode=disable"

# Actualizar drizzle config temporalmente
cat > drizzle.config.local.ts << EOF
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NEW_DATABASE_URL || "postgresql://postgres:password@localhost:5432/racephoto?sslmode=disable",
  },
});
EOF

echo "✅ Configuración de base de datos local lista"
echo "Nueva DATABASE_URL: $NEW_DATABASE_URL"