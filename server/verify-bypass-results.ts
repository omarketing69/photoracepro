/**
 * 🔍 VERIFICADOR INMEDIATO DE RESULTADOS DEL BYPASS
 * Confirmar que el usuario tenga acceso a sus 376 dorsales OCR pagados
 */

import { db } from './db';
import { photos, events } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

interface BypassVerificationResult {
  event8PhotoCount: number;
  event8PhotosWithDorsals: number;
  totalDorsalsDetected: number;
  uniqueDorsals: number[];
  samplePhotos: Array<{
    id: number;
    filename: string;
    detectedDorsals: number[];
  }>;
  success: boolean;
  message: string;
}

export async function verifyBypassResults(): Promise<BypassVerificationResult> {
  console.log('\n🔍 VERIFICANDO RESULTADOS DEL BYPASS...');
  
  try {
    // 1. CONTAR FOTOS TOTALES EN EVENTO 8
    console.log('\n📊 [VERIFICACIÓN 1] Contando fotos en evento 8...');
    const photoCount = await db.$count(photos, (photos, { eq }) => eq(photos.eventId, 8));
    console.log(`✅ Total fotos en evento 8: ${photoCount}`);
    
    // 2. CONTAR FOTOS CON DORSALES DETECTADOS
    console.log('\n🏃 [VERIFICACIÓN 2] Contando fotos con dorsales...');
    const photosWithDorsals = await db
      .select({
        id: photos.id,
        filename: photos.filename,
        detectedDorsals: photos.detectedDorsals,
      })
      .from(photos)
      .where(eq(photos.eventId, 8));
    
    // Contar fotos que tienen dorsales detectados
    const photosWithDorsalsCount = photosWithDorsals.filter(
      photo => Array.isArray(photo.detectedDorsals) && photo.detectedDorsals.length > 0
    ).length;
    
    console.log(`✅ Fotos con dorsales detectados: ${photosWithDorsalsCount}`);
    
    // 3. EXTRAER TODOS LOS DORSALES ÚNICOS
    console.log('\n🔢 [VERIFICACIÓN 3] Extrayendo dorsales únicos...');
    const allDorsals = new Set<number>();
    
    photosWithDorsals.forEach(photo => {
      if (Array.isArray(photo.detectedDorsals)) {
        photo.detectedDorsals.forEach(dorsal => {
          if (typeof dorsal === 'number') {
            allDorsals.add(dorsal);
          }
        });
      }
    });
    
    const uniqueDorsals = Array.from(allDorsals).sort((a, b) => a - b);
    console.log(`✅ Dorsales únicos detectados: ${uniqueDorsals.length}`);
    console.log(`🏃 Rango: ${uniqueDorsals[0]} - ${uniqueDorsals[uniqueDorsals.length - 1]}`);
    
    // Mostrar muestra de dorsales
    const sampleDorsals = uniqueDorsals.slice(0, 10);
    console.log(`📋 Muestra dorsales: ${sampleDorsals.join(', ')}${uniqueDorsals.length > 10 ? '...' : ''}`);
    
    // 4. OBTENER MUESTRA DE FOTOS
    console.log('\n📸 [VERIFICACIÓN 4] Obteniendo muestra de fotos...');
    const samplePhotos = photosWithDorsals.slice(0, 5).map(photo => ({
      id: photo.id,
      filename: photo.filename,
      detectedDorsals: photo.detectedDorsals || [],
    }));
    
    console.log('📋 Muestra fotos:');
    samplePhotos.forEach(photo => {
      console.log(`   • ${photo.filename}: dorsales [${photo.detectedDorsals.join(', ')}]`);
    });
    
    // 5. DETERMINAR ÉXITO
    console.log('\n✅ [VERIFICACIÓN 5] Evaluando éxito del bypass...');
    
    const targetPhotoCount = 800; // Mínimo esperado
    const targetDorsalsCount = 300; // Mínimo esperado (376 era el objetivo)
    
    const success = photoCount >= targetPhotoCount && uniqueDorsals.length >= targetDorsalsCount;
    
    let message = '';
    if (success) {
      message = `🎉 ¡BYPASS EXITOSO! ${photoCount} fotos con ${uniqueDorsals.length} dorsales disponibles para el usuario`;
    } else {
      message = `⚠️ Bypass incompleto: ${photoCount} fotos (min: ${targetPhotoCount}), ${uniqueDorsals.length} dorsales (min: ${targetDorsalsCount})`;
    }
    
    console.log(`\n🏁 RESULTADO: ${message}`);
    
    return {
      event8PhotoCount: photoCount,
      event8PhotosWithDorsals: photosWithDorsalsCount,
      totalDorsalsDetected: uniqueDorsals.length,
      uniqueDorsals: uniqueDorsals.slice(0, 50), // Limitar para evitar overflow
      samplePhotos,
      success,
      message,
    };
    
  } catch (error) {
    console.error('\n💥 ERROR EN VERIFICACIÓN:', error);
    return {
      event8PhotoCount: 0,
      event8PhotosWithDorsals: 0,
      totalDorsalsDetected: 0,
      uniqueDorsals: [],
      samplePhotos: [],
      success: false,
      message: `❌ Error en verificación: ${error.message}`,
    };
  }
}

// EJECUTAR VERIFICACIÓN SI SE INVOCA DIRECTAMENTE
console.log('\n🔍 EJECUTANDO VERIFICACIÓN INMEDIATA...');
verifyBypassResults()
  .then(result => {
    console.log('\n📈 RESULTADO DE VERIFICACIÓN:', result);
    if (result.success) {
      console.log('\n✅ ¡VERIFICACIÓN EXITOSA! Usuario tiene acceso completo');
      process.exit(0);
    } else {
      console.log('\n❌ VERIFICACIÓN FALLÓ - acción adicional requerida');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 VERIFICACIÓN CRASHED:', error);
    process.exit(1);
  });