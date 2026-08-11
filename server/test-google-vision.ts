import { compareAllOCRMethods, googleVisionProcessor } from './google-vision-ocr';
import { storage } from './storage';
import path from 'path';

// Test Google Vision with our known dorsals
export async function testGoogleVisionWithKnownDorsals(): Promise<void> {
  console.log('🧪 INICIANDO PRUEBAS DE GOOGLE VISION OCR');
  console.log('═'.repeat(60));
  
  const knownDorsals = [
    { dorsal: 1148, filename: 'dorsal-1148-detected.jpg' },
    { dorsal: 1431, filename: 'Antrid-1095_1751318763173.jpg' },
    { dorsal: 1531, filename: 'Antrid-1140_1751319355619.jpg' },
    { dorsal: 1253, filename: 'Antrid-106_1751318676996.jpg' }
  ];
  
  for (const test of knownDorsals) {
    const imagePath = path.join(process.cwd(), 'uploads', test.filename);
    console.log(`\n🔍 PROBANDO DORSAL ${test.dorsal}`);
    console.log(`📸 Archivo: ${test.filename}`);
    
    try {
      await compareAllOCRMethods(imagePath, test.dorsal);
    } catch (error) {
      console.error(`❌ Error probando ${test.filename}:`, error);
    }
    
    console.log('\n' + '─'.repeat(60));
  }
}

// Test with attached assets
export async function testWithAttachedAssets(): Promise<void> {
  console.log('\n🖼️ PROBANDO CON IMÁGENES ADJUNTAS');
  console.log('═'.repeat(60));
  
  const attachedImages = [
    'Antrid-1015_1751318180994.jpg',
    'Antrid-106_1751318676996.jpg', 
    'Antrid-1095_1751318763173.jpg',
    'Antrid-1140_1751319355619.jpg'
  ];
  
  for (const filename of attachedImages) {
    const imagePath = path.join(process.cwd(), 'attached_assets', filename);
    console.log(`\n📸 PROCESANDO: ${filename}`);
    
    try {
      const result = await googleVisionProcessor.processImage(imagePath);
      console.log(`✅ Dorsales detectados: [${result.dorsalNumbers.join(', ')}]`);
      console.log(`📊 Confianza: ${result.confidence}%`);
      console.log(`📄 Texto detectado: "${result.allText.substring(0, 200)}..."`);
      
      // Store results if dorsals were found
      if (result.dorsalNumbers.length > 0) {
        console.log(`🎯 ¡Dorsales encontrados! Guardando en base de datos...`);
        
        // Create photo record
        const photoData = {
          eventId: 1,
          filename: filename,
          originalPath: imagePath,
          detectedDorsals: result.dorsalNumbers,
          faces: [],
          processed: true,
          processingStatus: 'completed' as const
        };
        
        await storage.createPhoto(photoData);
        console.log(`💾 Guardado en base de datos`);
      }
      
    } catch (error) {
      console.error(`❌ Error procesando ${filename}:`, error);
    }
    
    console.log('─'.repeat(40));
  }
}

// Comprehensive test function
export async function runComprehensiveGoogleVisionTest(): Promise<void> {
  console.log('🚀 PRUEBA INTEGRAL DE GOOGLE VISION OCR');
  console.log('═'.repeat(80));
  
  try {
    // Test 1: Known dorsals comparison
    await testGoogleVisionWithKnownDorsals();
    
    // Test 2: Attached assets
    await testWithAttachedAssets();
    
    // Test 3: Database photos
    console.log('\n📚 PROBANDO CON FOTOS EN BASE DE DATOS');
    const photos = await storage.getAllPhotos(1, 50, 0); // Get first 50 photos
    
    let googleVisionWins = 0;
    let tesseractWins = 0;
    let ties = 0;
    let totalTests = 0;
    
    for (const photo of photos) {
      if (photo.detectedDorsals && photo.detectedDorsals.length > 0) {
        const expectedDorsal = photo.detectedDorsals[0]; // Use first detected dorsal
        console.log(`\n🎯 Probando foto ${photo.id} con dorsal esperado ${expectedDorsal}`);
        
        try {
          const googleResult = await googleVisionProcessor.processImage(photo.originalPath);
          const googleFound = googleResult.dorsalNumbers.includes(expectedDorsal);
          
          // We know Tesseract found it (it's in the database)
          const tesseractFound = true;
          
          totalTests++;
          
          if (googleFound && tesseractFound) {
            ties++;
            console.log('🤝 Empate - ambos encontraron el dorsal');
          } else if (googleFound && !tesseractFound) {
            googleVisionWins++;
            console.log('🥇 Google Vision ganó');
          } else if (!googleFound && tesseractFound) {
            tesseractWins++;
            console.log('🥇 Tesseract ganó');
          }
          
        } catch (error) {
          console.error(`❌ Error probando foto ${photo.id}:`, error);
        }
        
        // Limit tests to prevent long execution
        if (totalTests >= 10) break;
      }
    }
    
    // Final summary
    console.log('\n🏆 RESUMEN FINAL DE COMPARACIÓN:');
    console.log('═'.repeat(50));
    console.log(`📊 Total de pruebas: ${totalTests}`);
    console.log(`🥇 Google Vision ganó: ${googleVisionWins} veces`);
    console.log(`🥇 Tesseract ganó: ${tesseractWins} veces`);
    console.log(`🤝 Empates: ${ties} veces`);
    
    if (googleVisionWins > tesseractWins) {
      console.log('\n🎉 VEREDICTO: Google Vision OCR es superior');
    } else if (tesseractWins > googleVisionWins) {
      console.log('\n🎉 VEREDICTO: Tesseract OCR es superior');
    } else {
      console.log('\n🤝 VEREDICTO: Ambos métodos son equivalentes');
    }
    
  } catch (error) {
    console.error('❌ Error en prueba integral:', error);
  }
}

// Execute the test
runComprehensiveGoogleVisionTest().catch(console.error);