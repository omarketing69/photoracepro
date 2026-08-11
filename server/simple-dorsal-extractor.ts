import { db } from './db';
import { photos } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

export async function extractDorsalsFromFilenames() {
  try {
    console.log('🔄 Extrayendo dorsales de nombres de archivo - SIN costos OCR...');
    
    // Obtener fotos sin dorsales detectados
    const photosWithoutDorsals = await db
      .select()
      .from(photos)
      .where(sql`detected_dorsals IS NULL OR detected_dorsals::text = '[]' OR detected_dorsals::text = '' OR detected_dorsals::text = 'null'`)
      .limit(1000);

    console.log(`📸 Encontradas ${photosWithoutDorsals.length} fotos SIN dorsales para procesar`);

    let processed = 0;
    
    for (const photo of photosWithoutDorsals) {
      const dorsalFromFilename = extractDorsalFromFilename(photo.filename);
      
      if (dorsalFromFilename) {
        try {
          // Actualizar foto en base de datos con dorsal extraído
          await db
            .update(photos)
            .set({
              detectedDorsals: [dorsalFromFilename],
              processed: true,
              processingStatus: 'completed',
              processedAt: new Date()
            })
            .where(eq(photos.id, photo.id));

          processed++;
          
          if (processed % 100 === 0) {
            console.log(`📈 Procesadas ${processed} fotos con dorsales de filename...`);
          }
          
        } catch (error) {
          console.log(`❌ Error procesando foto ${photo.id}: ${error}`);
        }
      }
    }

    console.log(`✅ COMPLETADO - Extracción de filenames:`);
    console.log(`   📸 Fotos procesadas: ${processed}`);
    console.log(`   💰 Costo OCR: $0 (solo filenames)`);
    
    return {
      success: true,
      photosProcessed: processed,
      method: 'filename-extraction',
      cost: '$0'
    };

  } catch (error) {
    console.error('❌ Error extrayendo dorsales de filenames:', error);
    throw error;
  }
}

function extractDorsalFromFilename(filename: string): number | null {
  // Patrones para extraer dorsales de nombres de archivo:
  // anderson-1234.jpg -> 1234
  // sebas-567.jpg -> 567  
  // mario-8901.JPG -> 8901
  // josue-1512.jpg -> 1512
  
  const patterns = [
    /(?:anderson|sebas|mario|josue|juliana|jorge|cohen|antrid)-(\d{3,4})/i,
    /(\d{3,4})(?=\.[a-z]+$)/i, // Dorsal al final del filename
    /-(\d{3,4})-/g, // Dorsal entre guiones
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match && match[1]) {
      const dorsal = parseInt(match[1]);
      if (dorsal >= 100 && dorsal <= 9999) { // Dorsales válidos de maratón
        return dorsal;
      }
    }
  }

  return null;
}