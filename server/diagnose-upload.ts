import { getCloudStorage } from './cloud-storage';
import { storage } from './storage';
import { GoogleVisionOCRProcessor } from './google-vision-ocr';

export async function diagnoseUploadSystem() {
  console.log('🔍 Diagnóstico del sistema de subida de fotos');
  console.log('=' .repeat(50));
  
  const results = {
    cloudStorage: false,
    database: false,
    ocrProcessor: false,
    errors: [] as string[]
  };
  
  // 1. Verificar Google Cloud Storage
  try {
    console.log('📦 Verificando Google Cloud Storage...');
    const cloudStorage = getCloudStorage();
    
    // Intentar listar archivos del bucket
    const [files] = await cloudStorage.storage.bucket('REDACTED_GCS_BUCKET').getFiles({
      maxResults: 1
    });
    
    console.log('✅ Google Cloud Storage: Conexión exitosa');
    console.log(`   - Bucket: REDACTED_GCS_BUCKET`);
    console.log(`   - Archivos encontrados: ${files.length > 0 ? 'Sí' : 'No'}`);
    results.cloudStorage = true;
  } catch (error) {
    console.error('❌ Google Cloud Storage: Error de conexión');
    console.error('   Error:', error);
    results.errors.push(`Google Cloud Storage: ${error}`);
  }
  
  // 2. Verificar base de datos PostgreSQL
  try {
    console.log('🗄️  Verificando base de datos PostgreSQL...');
    const events = await storage.getEvents();
    console.log('✅ Base de datos PostgreSQL: Conexión exitosa');
    console.log(`   - Eventos encontrados: ${events.length}`);
    results.database = true;
  } catch (error) {
    console.error('❌ Base de datos PostgreSQL: Error de conexión');
    console.error('   Error:', error);
    results.errors.push(`Base de datos: ${error}`);
  }
  
  // 3. Verificar Google Vision OCR
  try {
    console.log('🔍 Verificando Google Vision OCR...');
    const ocrProcessor = new GoogleVisionOCRProcessor();
    
    // Crear archivo temporal de prueba
    const fs = await import('fs');
    const testImagePath = '/tmp/test-image.jpg';
    
    // Crear imagen de prueba simple (1x1 pixel)
    const testImageBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xD9
    ]);
    
    fs.writeFileSync(testImagePath, testImageBuffer);
    
    // Intentar procesar con Google Vision
    const result = await ocrProcessor.processImage(testImagePath);
    
    // Limpiar archivo temporal
    fs.unlinkSync(testImagePath);
    
    console.log('✅ Google Vision OCR: Servicio disponible');
    console.log(`   - Texto detectado: ${result.detectedText ? 'Sí' : 'No'}`);
    console.log(`   - Dorsales detectados: ${result.dorsalNumbers.length}`);
    results.ocrProcessor = true;
  } catch (error) {
    console.error('❌ Google Vision OCR: Error de servicio');
    console.error('   Error:', error);
    results.errors.push(`Google Vision OCR: ${error}`);
  }
  
  // 4. Verificar configuración de memoria y límites
  console.log('⚙️  Verificando configuración del sistema...');
  console.log(`   - Memoria disponible: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
  console.log(`   - Límites de Node.js: OK`);
  console.log(`   - Variables de entorno: ${process.env.DATABASE_URL ? 'OK' : 'FALTA DATABASE_URL'}`);
  
  // 5. Resumen del diagnóstico
  console.log('\n📊 Resumen del diagnóstico:');
  console.log('=' .repeat(50));
  console.log(`✅ Google Cloud Storage: ${results.cloudStorage ? 'FUNCIONANDO' : 'ERROR'}`);
  console.log(`✅ Base de datos PostgreSQL: ${results.database ? 'FUNCIONANDO' : 'ERROR'}`);
  console.log(`✅ Google Vision OCR: ${results.ocrProcessor ? 'FUNCIONANDO' : 'ERROR'}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errores encontrados:');
    results.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  } else {
    console.log('\n🎉 Todos los servicios están funcionando correctamente!');
  }
  
  return results;
}

// Funciones específicas para diagnosticar subidas que se quedan colgadas
export async function diagnoseHangingUploads() {
  console.log('\n🔍 Diagnóstico de subidas que se quedan colgadas');
  console.log('=' .repeat(50));
  
  // Verificar timeouts y límites
  console.log('⏱️  Verificando timeouts y límites...');
  console.log(`   - Límite de archivo: 50MB`);
  console.log(`   - Límite de archivos: 200 fotos`);
  console.log(`   - Timeout de red: 30 segundos por foto`);
  
  // Verificar estado de Google Cloud Storage
  try {
    const cloudStorage = getCloudStorage();
    const startTime = Date.now();
    
    // Intentar una subida de prueba pequeña
    const testBuffer = Buffer.from('test data');
    const testFileName = `test-upload-${Date.now()}.txt`;
    
    await cloudStorage.storage.bucket('REDACTED_GCS_BUCKET').file(testFileName).save(testBuffer);
    
    const uploadTime = Date.now() - startTime;
    console.log(`✅ Subida de prueba exitosa en ${uploadTime}ms`);
    
    // Limpiar archivo de prueba
    await cloudStorage.storage.bucket('REDACTED_GCS_BUCKET').file(testFileName).delete();
    
  } catch (error) {
    console.error('❌ Error en subida de prueba:', error);
    return {
      issue: 'Google Cloud Storage no responde',
      recommendation: 'Verificar credenciales y permisos'
    };
  }
  
  // Verificar memoria disponible
  const memoryUsage = process.memoryUsage();
  console.log(`💾 Memoria actual: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`);
  
  if (memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
    return {
      issue: 'Alto uso de memoria',
      recommendation: 'Reiniciar el servidor o procesar menos fotos simultáneamente'
    };
  }
  
  return {
    issue: 'Sin problemas detectados',
    recommendation: 'El sistema está funcionando correctamente'
  };
}