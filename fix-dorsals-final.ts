import postgres from 'postgres';

async function fixDorsalsFinal() {
  if (!process.env.DATABASE_URL) { throw new Error('DATABASE_URL env var required'); }
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    console.log('🎯 Corrección final: dorsales como números simples');
    
    // El problema es que los dorsales están como strings ["[100]"] en lugar de números [100]
    // Verificar el problema
    const sample = await sql`
      SELECT id, detected_dorsals
      FROM photos 
      WHERE detected_dorsals IS NOT NULL 
      LIMIT 3
    `;
    console.log('Muestra actual:', sample);
    
    // Corregir: extraer el número del string "[100]" y crear array real
    console.log('🔄 Convirtiendo strings de arrays a números reales...');
    
    // Método más simple: extraer solo los números
    await sql`
      UPDATE photos 
      SET detected_dorsals = (
        SELECT jsonb_agg(
          CAST(
            substring(elem::text from '\d+') AS integer
          )
        )
        FROM jsonb_array_elements(detected_dorsals) AS elem
        WHERE elem::text ~ '\d+'
      )
      WHERE detected_dorsals IS NOT NULL
      AND jsonb_array_length(detected_dorsals) > 0
    `;
    
    console.log('✅ Conversión completada');
    
    // Verificar resultado
    const verification = await sql`
      SELECT id, detected_dorsals
      FROM photos 
      WHERE detected_dorsals IS NOT NULL 
      LIMIT 3
    `;
    console.log('Resultado después de corrección:', verification);
    
    // Contar dorsales únicos finales
    const finalCount = await sql`
      SELECT COUNT(DISTINCT dorsal_element::int) as total_dorsals
      FROM (
        SELECT jsonb_array_elements(detected_dorsals) as dorsal_element
        FROM photos 
        WHERE detected_dorsals IS NOT NULL 
        AND jsonb_array_length(detected_dorsals) > 0
      ) dorsals
    `;
    console.log(`🎉 Total dorsales únicos FINALES: ${finalCount[0].total_dorsals}`);
    
    await sql.end();
    console.log('🚀 Sistema completamente restaurado!');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fixDorsalsFinal();