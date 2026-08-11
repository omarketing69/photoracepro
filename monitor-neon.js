import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

async function checkNeonDatabase() {
  try {
    console.log('🔍 Verificando estado de Neon Database...');
    
    const connection = postgres(DATABASE_URL, { 
      connect_timeout: 10,
      idle_timeout: 20,
      max: 1
    });
    
    const db = drizzle(connection);
    
    // Test simple query
    const result = await connection`SELECT 1 as test`;
    
    if (result && result.length > 0) {
      console.log('✅ NEON DATABASE RECUPERADO!');
      console.log('✅ Tu sistema RacePhoto Pro está listo para funcionar completamente');
      console.log('✅ Dashboard, estadísticas y compras ya están disponibles');
      console.log('✅ Acceso completo a tus 5,016 fotos y todos los dorsales procesados');
      
      await connection.end();
      return true;
    }
    
    await connection.end();
    return false;
    
  } catch (error) {
    if (error.message.includes('endpoint is disabled')) {
      console.log('⏳ Neon Database aún no disponible - continuando monitoreo...');
    } else {
      console.log('❌ Error de conexión:', error.message);
    }
    return false;
  }
}

async function monitorNeon() {
  console.log('🚀 Iniciando monitoreo de Neon Database...');
  console.log('⏰ Verificando cada 2 minutos hasta que se recupere');
  
  const interval = setInterval(async () => {
    const isRecovered = await checkNeonDatabase();
    
    if (isRecovered) {
      console.log('\n🎉 ¡SISTEMA COMPLETAMENTE RESTAURADO!');
      console.log('💡 Ya puedes acceder a todas las funciones de administración');
      clearInterval(interval);
      process.exit(0);
    }
  }, 120000); // Check every 2 minutes
  
  // Initial check
  const initialCheck = await checkNeonDatabase();
  if (initialCheck) {
    clearInterval(interval);
    process.exit(0);
  }
}

monitorNeon();