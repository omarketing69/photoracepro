import { getCloudStorage } from './cloud-storage';
import { storage } from './storage';

/**
 * Registrar fotos que ya están en Google Cloud Storage SIN volver a hacer OCR
 * Solo crear los registros en la base de datos para poder hacer búsquedas
 */
export async function registerExistingPhotos(): Promise<void> {
  try {
    const cloudStorage = getCloudStorage();
    const bucket = cloudStorage.storage.bucket(cloudStorage.bucketName);
    
    // Buscar fotos en todas las ubicaciones posibles
    const [allFiles] = await bucket.getFiles({
      prefix: 'eventos/',
    });
    
    // Filtrar solo fotos originales
    const originalFiles = allFiles.filter(file => 
      file.name.includes('/originales/') && 
      (file.name.endsWith('.jpg') || file.name.endsWith('.jpeg') || file.name.endsWith('.png'))
    );
    
    console.log(`📁 Encontradas ${originalFiles.length} fotos originales en Google Cloud Storage`);
    
    let registered = 0;
    let existing = 0;
    
    // Registrar cada foto SIN procesar OCR
    for (const file of originalFiles) {
      try {
        const filename = file.name.split('/').pop();
        if (!filename) continue;
        
        // Verificar si ya existe en la base de datos
        const existingPhotos = await storage.getPhotos(3);
        const existingPhoto = existingPhotos.find(p => p.filename === filename);
        
        if (existingPhoto) {
          existing++;
          console.log(`⏭️  Ya existe: ${filename}`);
          continue;
        }
        
        // Crear registro básico SIN OCR
        const originalPath = file.name;
        const webPath = originalPath.replace('/originales/', '/web/');
        const thumbnailPath = originalPath.replace('/originales/', '/miniaturas/');
        
        await storage.createPhoto({
          eventId: 3,
          filename,
          originalPath,
          webPath,
          thumbnailPath,
          detectedDorsals: [], // Sin dorsales por ahora
          faces: [],
          processed: false,
          processingStatus: 'pending',
        });
        
        registered++;
        console.log(`✅ Registrada: ${filename}`);
        
      } catch (error) {
        console.error(`❌ Error registrando foto:`, error);
      }
    }
    
    console.log(`\n📊 Resultado:`);
    console.log(`   ✅ Fotos registradas: ${registered}`);
    console.log(`   ⏭️  Fotos existentes: ${existing}`);
    console.log(`   📁 Total fotos encontradas: ${originalFiles.length}`);
    
  } catch (error) {
    console.error('💥 Error durante el registro:', error);
    throw error;
  }
}

// Ejecutar registro
registerExistingPhotos().then(() => {
  console.log('Registro completado');
  process.exit(0);
}).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});