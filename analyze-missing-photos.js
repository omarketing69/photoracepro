import { Pool } from 'pg';

// Configuración de PostgreSQL usando variables de entorno de Replit
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function analyzeMissingPhotos() {
  try {
    // Obtener todos los archivos en la base de datos
    const dbQuery = `
      SELECT DISTINCT filename 
      FROM photos 
      WHERE event_id = 1 
        AND filename LIKE '%-%-%'
      ORDER BY filename
    `;
    
    const result = await pool.query(dbQuery);
    const dbPhotos = result.rows.map(row => row.filename);
    
    console.log(`📊 Fotos en base de datos: ${dbPhotos.length}`);
    console.log(`📊 Esperadas según el total: 4,774`);
    console.log(`📊 Diferencia: ${4774 - dbPhotos.length} fotos faltantes`);
    
    // Analizar por fotógrafo
    const photographers = {};
    
    dbPhotos.forEach(filename => {
      const match = filename.match(/^(\d+)-([a-zA-Z]+)-(\d+)\.jpg$/);
      if (match) {
        const [, timestamp, photographer, number] = match;
        if (!photographers[photographer]) {
          photographers[photographer] = {
            numbers: [],
            timestamps: []
          };
        }
        photographers[photographer].numbers.push(parseInt(number));
        photographers[photographer].timestamps.push(parseInt(timestamp));
      }
    });
    
    console.log('\n🔍 ANÁLISIS POR FOTÓGRAFO:');
    console.log('=' .repeat(50));
    
    Object.entries(photographers).forEach(([photographer, data]) => {
      const numbers = data.numbers.sort((a, b) => a - b);
      const timestamps = data.timestamps.sort((a, b) => a - b);
      
      console.log(`\n📸 ${photographer.toUpperCase()}:`);
      console.log(`   Total fotos: ${numbers.length}`);
      console.log(`   Rango números: ${numbers[0]} - ${numbers[numbers.length - 1]}`);
      
      // Encontrar huecos en la numeración
      const gaps = [];
      for (let i = 0; i < numbers.length - 1; i++) {
        if (numbers[i + 1] - numbers[i] > 1) {
          gaps.push({
            start: numbers[i] + 1,
            end: numbers[i + 1] - 1
          });
        }
      }
      
      if (gaps.length > 0) {
        console.log(`   ⚠️  Huecos detectados:`);
        gaps.forEach(gap => {
          const missingCount = gap.end - gap.start + 1;
          console.log(`      - Números ${gap.start}-${gap.end} (${missingCount} fotos faltantes)`);
        });
      }
      
      // Analizar timestamps para detectar bloques perdidos
      const timestampGroups = [];
      let currentGroup = [timestamps[0]];
      
      for (let i = 1; i < timestamps.length; i++) {
        if (timestamps[i] - timestamps[i-1] > 60000) { // 1 minuto de diferencia
          timestampGroups.push(currentGroup);
          currentGroup = [timestamps[i]];
        } else {
          currentGroup.push(timestamps[i]);
        }
      }
      timestampGroups.push(currentGroup);
      
      console.log(`   📅 Bloques temporales: ${timestampGroups.length}`);
      timestampGroups.forEach((group, index) => {
        const startTime = new Date(group[0]).toLocaleString();
        const endTime = new Date(group[group.length - 1]).toLocaleString();
        console.log(`      Bloque ${index + 1}: ${group.length} fotos (${startTime} - ${endTime})`);
      });
    });
    
    // Generar estimaciones de archivos faltantes
    console.log('\n🔍 ESTIMACIÓN DE ARCHIVOS FALTANTES:');
    console.log('=' .repeat(50));
    
    const totalExpected = 4774;
    const totalFound = dbPhotos.length;
    const totalMissing = totalExpected - totalFound;
    
    console.log(`Total esperado: ${totalExpected}`);
    console.log(`Total encontrado: ${totalFound}`);
    console.log(`Total faltante: ${totalMissing}`);
    
    // Sugerir patrones de archivos a buscar
    console.log('\n🔍 PATRONES DE ARCHIVOS A BUSCAR:');
    console.log('=' .repeat(50));
    
    Object.entries(photographers).forEach(([photographer, data]) => {
      const numbers = data.numbers.sort((a, b) => a - b);
      const maxNumber = Math.max(...numbers);
      const expectedNumbers = Math.ceil(maxNumber * 1.2); // Estimación del 20% más
      
      console.log(`\n📸 ${photographer}:`);
      console.log(`   Patrón: *-${photographer}-*.jpg`);
      console.log(`   Números encontrados: hasta ${maxNumber}`);
      console.log(`   Posibles números faltantes: ${maxNumber + 1} - ${expectedNumbers}`);
    });
    
    // Buscar fotógrafos completamente faltantes
    console.log('\n🔍 POSIBLES FOTÓGRAFOS FALTANTES:');
    console.log('=' .repeat(50));
    
    const foundPhotographers = Object.keys(photographers);
    const possiblePhotographers = ['mario', 'cohen', 'jose', 'carlos', 'daniel', 'miguel'];
    
    const missingPhotographers = possiblePhotographers.filter(p => !foundPhotographers.includes(p));
    
    if (missingPhotographers.length > 0) {
      console.log('Fotógrafos que podrían tener fotos faltantes:');
      missingPhotographers.forEach(photographer => {
        console.log(`   - Patrón: *-${photographer}-*.jpg`);
      });
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

analyzeMissingPhotos();