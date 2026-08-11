import postgres from 'postgres';

console.log('🔍 Verificando DATABASE_URL_NEW...');
console.log('DATABASE_URL_NEW value:', process.env.DATABASE_URL_NEW);

if (!process.env.DATABASE_URL_NEW) {
  console.log('❌ DATABASE_URL_NEW no está configurado');
  process.exit(1);
}

// Check if it's a complete URL or just an endpoint
const urlValue = process.env.DATABASE_URL_NEW;
if (!urlValue.startsWith('postgresql://') && !urlValue.startsWith('postgres://')) {
  console.log('❌ DATABASE_URL_NEW parece ser solo un endpoint, no una URL completa');
  console.log('💡 Debe ser algo como: postgresql://user:password@host:port/database');
  process.exit(1);
}

try {
  console.log('🔗 Intentando conectar a la nueva base de datos...');
  const sql = postgres(urlValue, {
    ssl: 'prefer',
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10
  });
  
  // Test connection
  const result = await sql`SELECT version()`;
  console.log('✅ Conexión exitosa!');
  console.log('🔧 PostgreSQL version:', result[0].version);
  
  // Test creating a table
  await sql`CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY, name TEXT)`;
  console.log('✅ Tabla de prueba creada exitosamente');
  
  // Clean up
  await sql`DROP TABLE IF EXISTS test_table`;
  console.log('✅ Tabla de prueba eliminada');
  
  await sql.end();
  console.log('🎉 Nueva base de datos está completamente funcional!');
  
} catch (error) {
  console.error('❌ Error al conectar:', error);
  process.exit(1);
}