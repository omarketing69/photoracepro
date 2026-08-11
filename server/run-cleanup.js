import { Storage } from '@google-cloud/storage';

async function cleanupGoogleCloudStorage() {
  console.log('🧹 Iniciando limpieza de Google Cloud Storage...');
  
  try {
    // Initialize Google Cloud Storage with credentials
    const storage = new Storage({
      projectId: 'REDACTED_GCS_PROJECT',
      keyFilename: '../google-credentials.json'
    });
    
    const bucketName = 'REDACTED_GCS_BUCKET';
    const bucket = storage.bucket(bucketName);
    
    // List all files in the bucket
    const [files] = await bucket.getFiles();
    console.log(`Encontrados ${files.length} archivos en Google Cloud Storage`);
    
    // Delete all files
    let deletedCount = 0;
    for (const file of files) {
      try {
        await file.delete();
        console.log(`   ✓ Eliminado: ${file.name}`);
        deletedCount++;
      } catch (error) {
        console.log(`   ⚠️  Error eliminando ${file.name}:`, error.message);
      }
    }
    
    console.log(`✅ Limpieza completada: ${deletedCount} archivos eliminados de Google Cloud Storage`);
    
    return {
      success: true,
      deletedFiles: deletedCount,
      totalFiles: files.length
    };
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Execute cleanup
cleanupGoogleCloudStorage().then(result => {
  console.log('\n📋 Resultado final:', result);
  process.exit(result.success ? 0 : 1);
});