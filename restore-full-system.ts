import postgres from 'postgres';

async function restoreFullSystem() {
  if (!process.env.DATABASE_URL) { throw new Error('DATABASE_URL env var required'); }
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    console.log('🚀 Restaurando sistema completo - más de 3000 dorsales');
    
    // 1. Verificar el problema real con detected_dorsals
    const problemPhotos = await sql`
      SELECT COUNT(*) as count, pg_typeof(detected_dorsals) as type
      FROM photos 
      WHERE detected_dorsals IS NOT NULL
      GROUP BY pg_typeof(detected_dorsals)
    `;
    console.log('Tipos de detected_dorsals:', problemPhotos);
    
    // 2. Corregir cualquier detected_dorsals que no sea array
    console.log('🔄 Asegurando que todos los detected_dorsals sean arrays...');
    
    // Encontrar fotos con detected_dorsals como texto simple
    const scalarCount = await sql`
      SELECT COUNT(*) as count 
      FROM photos 
      WHERE detected_dorsals IS NOT NULL 
      AND jsonb_typeof(detected_dorsals) != 'array'
    `;
    console.log(`Fotos con detected_dorsals como scalar: ${scalarCount[0].count}`);
    
    if (scalarCount[0].count > 0) {
      // Convertir scalars a arrays
      await sql`
        UPDATE photos 
        SET detected_dorsals = jsonb_build_array(detected_dorsals)
        WHERE detected_dorsals IS NOT NULL 
        AND jsonb_typeof(detected_dorsals) != 'array'
      `;
      console.log(`✅ Convertidos ${scalarCount[0].count} scalars a arrays`);
    }
    
    // 3. Contar dorsales únicos reales
    const uniqueDorsals = await sql`
      SELECT COUNT(DISTINCT dorsal_element) as total_dorsals
      FROM (
        SELECT jsonb_array_elements_text(detected_dorsals) as dorsal_element
        FROM photos 
        WHERE detected_dorsals IS NOT NULL 
        AND jsonb_array_length(detected_dorsals) > 0
      ) dorsals
    `;
    console.log(`🎯 Total dorsales únicos en base de datos: ${uniqueDorsals[0].total_dorsals}`);
    
    // 4. Verificar algunos dorsales específicos
    const sampleDorsals = await sql`
      SELECT jsonb_array_elements_text(detected_dorsals) as dorsal
      FROM photos 
      WHERE detected_dorsals IS NOT NULL 
      AND jsonb_array_length(detected_dorsals) > 0
      LIMIT 10
    `;
    console.log('Muestra de dorsales:', sampleDorsals.map(d => d.dorsal));
    
    // 5. Verificar paths de thumbnails
    const thumbnailPaths = await sql`
      SELECT COUNT(*) as total, 
             COUNT(CASE WHEN thumbnail_path LIKE 'eventos/1/miniaturas/%' THEN 1 END) as correct_paths
      FROM photos
    `;
    console.log(`Paths de thumbnails: ${thumbnailPaths[0].correct_paths}/${thumbnailPaths[0].total} correctos`);
    
    await sql.end();
    console.log('🎉 Sistema restaurado - debería mostrar todos los dorsales y miniaturas');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

restoreFullSystem();