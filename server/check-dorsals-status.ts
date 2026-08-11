import { db } from './db';
import { photos } from '../shared/schema';
import { sql } from 'drizzle-orm';

export async function checkDorsalsStatus() {
  try {
    console.log('🔍 Verificando estado de dorsales en base de datos...');
    
    const photosWithDorsals = await db
      .select({ count: sql<number>`count(*)` })
      .from(photos)
      .where(sql`detected_dorsals IS NOT NULL AND detected_dorsals::text != '[]' AND detected_dorsals::text != '' AND detected_dorsals::text != 'null'`);

    const photosWithoutDorsals = await db
      .select({ count: sql<number>`count(*)` })
      .from(photos)
      .where(sql`detected_dorsals IS NULL OR detected_dorsals::text = '[]' OR detected_dorsals::text = '' OR detected_dorsals::text = 'null'`);

    const totalPhotos = await db
      .select({ count: sql<number>`count(*)` })
      .from(photos);

    const withDorsals = photosWithDorsals[0]?.count || 0;
    const withoutDorsals = photosWithoutDorsals[0]?.count || 0;
    const total = totalPhotos[0]?.count || 0;

    console.log('📊 ESTADO DE DORSALES:');
    console.log(`   Total fotos: ${total}`);
    console.log(`   ✅ CON dorsales detectados: ${withDorsals}`);
    console.log(`   ❌ SIN dorsales detectados: ${withoutDorsals}`);
    console.log(`   📈 Porcentaje procesado: ${((withDorsals / total) * 100).toFixed(1)}%`);

    return {
      total,
      withDorsals,
      withoutDorsals,
      percentageProcessed: (withDorsals / total) * 100
    };

  } catch (error) {
    console.error('❌ Error verificando estado de dorsales:', error);
    throw error;
  }
}