import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';

async function testDatabase() {
  try {
    console.log('🔍 Probando Neon Database...');
    
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);
    
    // Test simple query
    const events = await sql`SELECT id, name, (SELECT COUNT(*) FROM photos WHERE event_id = events.id) as photo_count FROM events LIMIT 5`;
    console.log('✅ Eventos encontrados:', events.length);
    
    for (const event of events) {
      console.log(`  - Evento ${event.id}: ${event.name} (${event.photo_count} fotos)`);
    }
    
    const totalPhotos = await sql`SELECT COUNT(*) as total FROM photos`;
    console.log('✅ Total fotos en DB:', totalPhotos[0].total);
    
    const uniqueDorsals = await sql`SELECT COUNT(DISTINCT dorsal) as count FROM (SELECT unnest(detected_dorsals) as dorsal FROM photos WHERE detected_dorsals IS NOT NULL AND array_length(detected_dorsals, 1) > 0) AS dorsals_unnested WHERE dorsal ~ '^[0-9]+$'`;
    console.log('✅ Dorsals únicos:', uniqueDorsals[0].count);
    
    console.log('🎉 ¡BASE DE DATOS COMPLETAMENTE FUNCIONAL!');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.message.includes('endpoint is disabled')) {
      console.log('💡 Neon Database endpoint está deshabilitado');
    }
  }
}

testDatabase();