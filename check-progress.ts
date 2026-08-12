import postgres from 'postgres';

async function checkProgress() {
  if (!process.env.DATABASE_URL) { throw new Error('DATABASE_URL env var required'); }
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    const photos = await sql`SELECT COUNT(*) as count FROM photos`;
    const events = await sql`SELECT id, name FROM events ORDER BY id`;
    const dorsals = await sql`SELECT COUNT(*) as photos_with_dorsals FROM photos WHERE detected_dorsals IS NOT NULL AND detected_dorsals::text != '[]'`;
    
    console.log('📊 Estado actual de la nueva base de datos:');
    console.log('✅ Eventos:', events.length);
    events.forEach(event => console.log(`  - ID ${event.id}: ${event.name}`));
    console.log(`✅ Fotos totales: ${photos[0].count}`);
    console.log(`✅ Fotos con dorsals: ${dorsals[0].photos_with_dorsals}`);
    
    // Verificar distribución por eventos
    const eventDistribution = await sql`SELECT event_id, COUNT(*) as count FROM photos GROUP BY event_id ORDER BY event_id`;
    console.log('📊 Distribución por eventos:');
    eventDistribution.forEach(event => console.log(`  - Evento ${event.event_id}: ${event.count} fotos`));
    
    await sql.end();
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkProgress();