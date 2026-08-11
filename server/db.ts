import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

// CONFIGURACIÓN CRÍTICA: Usar la base de datos que contiene las 898 fotos del Evento 8
const createCorrectDatabaseUrl = () => {
  // PRIORIDAD 1: DATABASE_URL (donde están las 898 fotos del Evento 8)
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgresql://')) {
    console.log('✅ USANDO BASE DE DATOS CON FOTOS: DATABASE_URL (ep-wint...)');
    return process.env.DATABASE_URL;
  }
  
  // Respaldo solo si DATABASE_URL no existe
  console.error('❌ DATABASE_URL no encontrado - usando respaldo pero puede no tener las fotos');
  const respaldoBaseDatos = "postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require";
  return respaldoBaseDatos;
};

const connectionString = createCorrectDatabaseUrl();
console.log('🔍 BASE DE DATOS ACTIVA:', connectionString.includes('ep-wint') ? 'CORRECTA con fotos Evento 8 ✅' : '⚠️  Verificar que tenga las 898 fotos');

export const connection = postgres(connectionString, {
  ssl: connectionString.includes('localhost') ? false : 'prefer',
  max: 1,
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