import postgres from 'postgres';

async function consolidateToEvent1() {
  const sql = postgres('postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require');
  
  try {
    console.log('🔄 Consolidando todas las fotos al evento 1...');
    
    // Mover todas las fotos de eventos 2 y 3 al evento 1
    const updateResult = await sql`
      UPDATE photos 
      SET event_id = 1 
      WHERE event_id IN (2, 3)
    `;
    
    console.log(`✅ Actualizadas ${updateResult.count} fotos al evento 1`);
    
    // Actualizar precios de eventos duplicados al evento 1
    await sql`UPDATE event_pricing SET event_id = 1 WHERE event_id IN (2, 3)`;
    console.log('✅ Precios consolidados al evento 1');
    
    // Actualizar estadísticas de eventos duplicados al evento 1
    await sql`UPDATE processing_stats SET event_id = 1 WHERE event_id IN (2, 3)`;
    console.log('✅ Estadísticas consolidadas al evento 1');
    
    // Eliminar eventos duplicados 2 y 3
    await sql`DELETE FROM events WHERE id IN (2, 3)`;
    console.log('✅ Eventos duplicados eliminados');
    
    // Verificar resultado final
    const finalCheck = await sql`SELECT COUNT(*) as count FROM photos WHERE event_id = 1`;
    const events = await sql`SELECT id, name FROM events ORDER BY id`;
    
    console.log('📊 Estado final:');
    console.log('✅ Eventos restantes:', events.length);
    events.forEach(event => console.log(`  - ID ${event.id}: ${event.name}`));
    console.log(`✅ Fotos en evento 1: ${finalCheck[0].count}`);
    
    await sql.end();
    console.log('🎉 Consolidación completada exitosamente!');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

consolidateToEvent1();