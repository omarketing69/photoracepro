import postgres from 'postgres';

async function fixPhotoPaths() {
  if (!process.env.DATABASE_URL) { throw new Error('DATABASE_URL env var required'); }
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    console.log('🔄 Corrigiendo rutas duplicadas en la base de datos...');
    
    // Obtener todas las fotos con rutas duplicadas (patrón más específico)
    const photos = await sql`
      SELECT id, filename, original_path, web_path, thumbnail_path 
      FROM photos 
      WHERE original_path LIKE '%eventos/1/originales/eventos/1/originales/%'
      LIMIT 10
    `;
    
    console.log(`📊 Encontradas ${photos.length} fotos con rutas duplicadas a corregir`);
    
    if (photos.length > 0) {
      console.log('Ejemplos de rutas a corregir:');
      photos.forEach(photo => {
        console.log(`- ID ${photo.id}: ${photo.original_path}`);
      });
    }
    
    // Corregir rutas duplicadas específicamente para eventos/1/originales/eventos/1/
    const updateResult = await sql`
      UPDATE photos 
      SET 
        original_path = REPLACE(original_path, 'eventos/1/originales/eventos/1/originales/', 'eventos/1/originales/'),
        web_path = REPLACE(web_path, 'eventos/1/web/eventos/1/originales/', 'eventos/1/web/'),
        thumbnail_path = REPLACE(thumbnail_path, 'eventos/1/miniaturas/eventos/1/originales/', 'eventos/1/miniaturas/')
      WHERE 
        original_path LIKE '%eventos/1/originales/eventos/1/originales/%' OR
        web_path LIKE '%eventos/1/web/eventos/1/originales/%' OR 
        thumbnail_path LIKE '%eventos/1/miniaturas/eventos/1/originales/%'
    `;
    
    console.log(`✅ Actualizadas ${updateResult.count} fotos con rutas corregidas`);
    
    // Verificar resultado
    const correctedPhotos = await sql`
      SELECT id, filename, original_path, web_path, thumbnail_path 
      FROM photos 
      WHERE original_path LIKE '%/eventos/%/originales/eventos/%'
      LIMIT 5
    `;
    
    console.log(`📊 Fotos restantes con rutas duplicadas: ${correctedPhotos.length}`);
    
    // Mostrar ejemplos de rutas corregidas
    const sampleCorrected = await sql`
      SELECT id, filename, original_path, thumbnail_path 
      FROM photos 
      ORDER BY id 
      LIMIT 5
    `;
    
    console.log('Ejemplos de rutas corregidas:');
    sampleCorrected.forEach(photo => {
      console.log(`- ID ${photo.id}: ${photo.original_path}`);
      console.log(`  Thumbnail: ${photo.thumbnail_path}`);
    });
    
    await sql.end();
    console.log('🎉 Corrección de rutas completada!');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fixPhotoPaths();