import { getCloudStorage } from './cloud-storage';
import { db } from './db';
import { photos } from '../shared/schema';
import { eq, like, sql } from 'drizzle-orm';

export async function fixEventOrganization() {
  const cloudStorage = getCloudStorage();
  const bucket = cloudStorage.storage.bucket('REDACTED_GCS_BUCKET');
  
  console.log('Checking current cloud storage state...');
  
  // Verificar archivos en evento 3
  const [event3Files] = await bucket.getFiles({ prefix: 'eventos/3/' });
  console.log(`Found ${event3Files.length} files in eventos/3/`);
  
  if (event3Files.length > 0) {
    console.log('Moving files from eventos/3/ to eventos/1/...');
    
    for (const file of event3Files) {
      const newName = file.name.replace('eventos/3/', 'eventos/1/');
      try {
        await file.move(newName);
        console.log(`✅ Moved: ${file.name} -> ${newName}`);
      } catch (error) {
        console.error(`❌ Error moving ${file.name}:`, error);
      }
    }
  }
  
  // Actualizar todas las rutas en la base de datos
  console.log('Updating database paths...');
  
  // Actualizar rutas de thumbnails que contienen eventos/3
  const thumbnailUpdate = await db
    .update(photos)
    .set({
      thumbnailPath: sql`REPLACE(thumbnail_path, 'eventos/3/', 'eventos/1/')`
    })
    .where(like(photos.thumbnailPath, '%eventos/3/%'))
    .returning();
  
  console.log(`Updated ${thumbnailUpdate.length} thumbnail paths`);
  
  // Verificar archivos en evento 1 después del movimiento
  const [event1Files] = await bucket.getFiles({ prefix: 'eventos/1/' });
  console.log(`Now have ${event1Files.length} files in eventos/1/`);
  
  return {
    moved: event3Files.length,
    updated: thumbnailUpdate.length,
    finalFiles: event1Files.length
  };
}

// Ejecutar si se llama directamente
if (import.meta.main) {
  fixEventOrganization().catch(console.error);
}