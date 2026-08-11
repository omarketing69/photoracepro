import { GoogleVisionRestProcessor } from './google-vision-rest.js';

async function testGoogleVisionOCR() {
  console.log('🔍 Probando Google Vision OCR...');
  
  const processor = new GoogleVisionRestProcessor();
  
  // Usar una imagen de attached_assets
  const testImage = '../attached_assets/image_1751420887730.png';
  console.log(`🔍 Probando con: ${testImage}`);
  
  try {
    const result = await processor.processImage(testImage);
    
    console.log('\n✅ RESULTADO DEL OCR:');
    console.log('📊 Dorsales detectados:', result.dorsalNumbers);
    console.log('📈 Nivel de confianza:', result.confidence);
    console.log('📝 Texto completo detectado:');
    console.log(result.allText);
    console.log('\n🔍 Palabras individuales detectadas:');
    result.detectedWords.forEach((word, index) => {
      console.log(`  ${index + 1}. "${word.text}" (confianza: ${word.confidence})`);
    });
    
    if (result.dorsalNumbers.length > 0) {
      console.log('\n🎯 ¡Google Vision OCR funcionando correctamente!');
    } else {
      console.log('\n⚠️ Google Vision OCR está funcionando pero no detectó dorsales en esta imagen');
    }
    
  } catch (error) {
    console.error('❌ Error probando Google Vision OCR:', error);
  }
}

// Ejecutar automáticamente
testGoogleVisionOCR();

export { testGoogleVisionOCR };