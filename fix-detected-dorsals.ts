import postgres from 'postgres';

async function fixDetectedDorsals() {
  if (!process.env.DATABASE_URL) { throw new Error('DATABASE_URL env var required'); }
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    console.log('🔄 Verificando y corrigiendo detected_dorsals...');
    
    // Verificar el tipo de datos actual
    const samplePhotos = await sql`
      SELECT id, detected_dorsals, pg_typeof(detected_dorsals) as type_name
      FROM photos 
      WHERE detected_dorsals IS NOT NULL
      LIMIT 5
    `;
    
    console.log('📊 Muestra de detected_dorsals:');
    samplePhotos.forEach(photo => {
      console.log(`- ID ${photo.id}: ${photo.detected_dorsals} (tipo: ${photo.type_name})`);
    });
    
    // Contar fotos que necesitan corrección (detectar si son strings que parecen JSON)
    const stringDorsals = await sql`
      SELECT COUNT(*) as count 
      FROM photos 
      WHERE detected_dorsals IS NOT NULL 
      AND detected_dorsals::text LIKE '[%]'
    `;
    
    console.log(`📊 Fotos con detected_dorsals como string JSON: ${stringDorsals[0].count}`);
    
    // Si están como strings, convertirlas a JSONB
    if (stringDorsals[0].count > 0) {
      console.log('🔄 Convirtiendo detected_dorsals de string a JSONB...');
      
      const updateResult = await sql`
        UPDATE photos 
        SET detected_dorsals = detected_dorsals::jsonb
        WHERE detected_dorsals IS NOT NULL 
        AND detected_dorsals::text LIKE '[%]'
      `;
      
      console.log(`✅ Actualizadas ${updateResult.count} fotos con detected_dorsals convertidos a JSONB`);
    }
    
    // Verificar el resultado final
    const finalSample = await sql`
      SELECT id, detected_dorsals, pg_typeof(detected_dorsals) as type_name
      FROM photos 
      WHERE detected_dorsals IS NOT NULL
      LIMIT 5
    `;
    
    console.log('📊 Muestra final de detected_dorsals:');
    finalSample.forEach(photo => {
      console.log(`- ID ${photo.id}: ${photo.detected_dorsals} (tipo: ${photo.type_name})`);
    });
    
    await sql.end();
    console.log('🎉 Corrección de detected_dorsals completada!');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fixDetectedDorsals();