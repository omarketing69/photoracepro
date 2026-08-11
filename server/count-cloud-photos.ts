import { getCloudStorage } from './cloud-storage';

/**
 * Contar todas las fotos en Google Cloud Storage por evento
 */
export async function countCloudPhotos(eventId: number): Promise<{
  totalFiles: number;
  originales: number;
  web: number;
  miniaturas: number;
  fileList: string[];
}> {
  try {
    const cloudStorage = getCloudStorage();
    const bucket = cloudStorage.storage.bucket(cloudStorage.bucketName);
    
    // Obtener todos los archivos del evento
    const [allFiles] = await bucket.getFiles({
      prefix: `eventos/${eventId}/`,
    });
    
    // Contar por tipo
    const originales = allFiles.filter(file => file.name.includes('/originales/')).length;
    const web = allFiles.filter(file => file.name.includes('/web/')).length;
    const miniaturas = allFiles.filter(file => file.name.includes('/miniaturas/')).length;
    
    // Lista de nombres de archivos originales
    const fileList = allFiles
      .filter(file => file.name.includes('/originales/'))
      .map(file => file.name.split('/').pop() || '')
      .filter(name => name.length > 0);
    
    return {
      totalFiles: allFiles.length,
      originales,
      web,
      miniaturas,
      fileList,
    };
  } catch (error) {
    console.error('Error counting cloud photos:', error);
    throw error;
  }
}

// Función para ejecutar el conteo
export async function runPhotoCount(eventId: number = 3): Promise<void> {
  console.log(`🔍 Contando fotos en Google Cloud Storage para evento ${eventId}`);
  
  try {
    const result = await countCloudPhotos(eventId);
    
    console.log(`\n📊 Resultados del conteo:`);
    console.log(`   📁 Total de archivos: ${result.totalFiles}`);
    console.log(`   📸 Fotos originales: ${result.originales}`);
    console.log(`   🌐 Versiones web: ${result.web}`);
    console.log(`   🖼️  Miniaturas: ${result.miniaturas}`);
    console.log(`\n📋 Primeros 10 archivos:`);
    result.fileList.slice(0, 10).forEach((file, index) => {
      console.log(`   ${index + 1}. ${file}`);
    });
    
    if (result.fileList.length > 10) {
      console.log(`   ... y ${result.fileList.length - 10} más`);
    }
    
  } catch (error) {
    console.error('💥 Error durante el conteo:', error);
  }
}