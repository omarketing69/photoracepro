import { getCloudStorage } from './cloud-storage';

export async function checkGoogleCloudStorage() {
  const cloudStorage = getCloudStorage();
  
  console.log('🔍 Verificando Google Cloud Storage...');
  
  try {
    // Verificar archivos en evento 1
    const eventFiles = await cloudStorage.listEventFiles(1);
    console.log(`📂 Archivos encontrados en evento 1: ${eventFiles.length}`);
    
    if (eventFiles.length > 0) {
      console.log('📋 Primeros 10 archivos:');
      eventFiles.slice(0, 10).forEach(file => console.log(`  - ${file}`));
    }
    
    // Verificar estadísticas de evento 1
    const stats = await cloudStorage.getEventStorageStats(1);
    console.log('📊 Estadísticas de almacenamiento:', stats);
    
    return {
      totalFiles: eventFiles.length,
      files: eventFiles,
      stats: stats
    };
  } catch (error) {
    console.error('❌ Error verificando Google Cloud Storage:', error);
    return {
      error: error.message,
      totalFiles: 0,
      files: [],
      stats: null
    };
  }
}