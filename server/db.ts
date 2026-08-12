import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

// CONFIGURACIÓN CRÍTICA: la URL de la DB DEBE venir de variables de entorno.
// Nunca hardcodear credenciales en el código (se confirmará al repo público).
const createCorrectDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith('postgresql://')) {
    throw new Error(
      'DATABASE_URL env var is required (must start with postgresql://). ' +
      'Do not hardcode credentials in source. Set it in .env.local or your host secrets.'
    );
  }
  return url;
};

const connectionString = createCorrectDatabaseUrl();

export const connection = postgres(connectionString, {
  ssl: connectionString.includes('localhost') ? false : 'prefer',
  max: Number(process.env.DB_POOL_MAX) || 10,
  idle_timeout: 20,
  connect_timeout: 10
});

export const db = drizzle(connection, { schema });

// Export pool para compatibilidad con storage.ts
export const pool = connection;

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing database pool...');
  await pool.end();
  process.exit(0);
});