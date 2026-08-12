import postgres from 'postgres';

async function quickFixDorsals() {
  if (!process.env.DATABASE_URL) { throw new Error('DATABASE_URL env var required'); }
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    console.log('🚀 Rápida corrección de dorsals - restaurando funcionamiento previo');
    
    // Verificar estructura actual
    const sample = await sql`SELECT id, detected_dorsals, pg_typeof(detected_dorsals) as type FROM photos LIMIT 3`;
    console.log('Estado actual:', sample);
    
    // Si los dorsals están como string "[100]", convertir a array real
    const stringCheck = await sql`SELECT COUNT(*) as count FROM photos WHERE detected_dorsals::text LIKE '"%"'`;
    console.log('Fotos con dorsals como string:', stringCheck[0].count);
    
    // Los dorsals están como strings "[100]", convertir a JSONB real
    console.log('🔄 Convirtiendo strings JSON a arrays JSONB reales...');
    
    await sql`
      UPDATE photos 
      SET detected_dorsals = detected_dorsals::text::jsonb
      WHERE detected_dorsals IS NOT NULL
    `;
    
    console.log('✅ Convertidos dorsals a JSONB arrays reales');
    
    // Verificar algunos dorsals específicos que deberían existir
    const testDorsals = [1176, 1174, 1173, 1166, 1162];
    for (const dorsal of testDorsals) {
      const count = await sql`
        SELECT COUNT(*) as count 
        FROM photos 
        WHERE detected_dorsals::jsonb @> ${JSON.stringify([dorsal.toString()])}
      `;
      console.log(`Dorsal ${dorsal}: ${count[0].count} fotos`);
    }
    
    await sql.end();
    console.log('🎉 Corrección rápida completada - sistema restaurado');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

quickFixDorsals();