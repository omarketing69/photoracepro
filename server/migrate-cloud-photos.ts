import { getCloudStorage } from './cloud-storage';

/**
 * Migrar fotos del evento 1 al evento 3 en Google Cloud Storage
 */
export async function migrateCloudPhotos(): Promise<void> {
  try {
    const cloudStorage = getCloudStorage();
    const bucket = cloudStorage.storage.bucket(cloudStorage.bucketName);
    
    // Obtener todas las fotos del evento 1
    const [evento1Files] = await bucket.getFiles({
      prefix: 'eventos/1/',
    });
    
    console.log(`🔄 Migrando ${evento1Files.length} archivos del evento 1 al evento 3`);
    
    // Mover cada archivo del evento 1 al evento 3
    for (const file of evento1Files) {
      const oldPath = file.name;
      const newPath = oldPath.replace('eventos/1/', 'eventos/3/');
      
      try {
        // Copiar archivo a nueva ubicación
        await file.copy(bucket.file(newPath));
        
        // Eliminar archivo original
        await file.delete();
        
        console.log(`✅ Migrado: ${oldPath} → ${newPath}`);
      } catch (error) {
        console.error(`❌ Error migrando ${oldPath}:`, error);
      }
    }
    
    console.log(`🎉 Migración completada`);
  } catch (error) {
    console.error('💥 Error durante la migración:', error);
    throw error;
  }
}

// Ejecutar migración
migrateCloudPhotos().then(() => {
  console.log('Migración completada exitosamente');
  process.exit(0);
}).catch(error => {
  console.error('Error en migración:', error);
  process.exit(1);
});