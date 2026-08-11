import { db } from './server/db';
import { photos } from './shared/schema';
import { eq, sql } from 'drizzle-orm';

function extractDorsalFromFilename(filename: string): number | null {
  const patterns = [
    /(?:anderson|sebas|mario|josue|juliana|jorge|cohen|antrid)-(\d{3,4})/i,
    /(\d{3,4})(?=\.[a-z]+$)/i,
    /-(\d{3,4})-/g,
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match && match[1]) {
      const dorsal = parseInt(match[1]);
      if (dorsal >= 100 && dorsal <= 9999) {
        return dorsal;
      }
    }
  }
  return null;
}

async function fixDorsals() {
  console.log('🔄 Extrayendo dorsales de nombres de archivo...');
  
  const photosWithoutDorsals = await db
    .select()
    .from(photos)
    .where(sql`detected_dorsals IS NULL OR jsonb_array_length(detected_dorsals) = 0`)
    .limit(500);

  console.log(`📸 Encontradas ${photosWithoutDorsals.length} fotos sin dorsales`);

  let processed = 0;
  
  for (const photo of photosWithoutDorsals) {
    const dorsal = extractDorsalFromFilename(photo.filename);
    
    if (dorsal) {
      await db
        .update(photos)
        .set({
          detectedDorsals: [dorsal],
          processed: true,
          processingStatus: 'completed',
          processedAt: new Date()
        })
        .where(eq(photos.id, photo.id));

      processed++;
      
      if (processed % 50 === 0) {
        console.log(`📈 Procesadas ${processed} fotos...`);
      }
    }
  }

  console.log(`✅ COMPLETADO: ${processed} fotos procesadas`);
  process.exit(0);
}

fixDorsals().catch(console.error);