import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';

export async function processSpecificImage(imagePath: string): Promise<void> {
  console.log(`\n=== PROCESANDO IMAGEN ESPECÍFICA: ${imagePath} ===`);
  
  try {
    // Crear versión optimizada específicamente para dorsal 1431
    const optimizedPath = path.join(process.cwd(), 'temp', 'dorsal-1431-optimized.png');
    
    await sharp(imagePath)
      .grayscale()
      .resize(1200, 1600, { fit: 'inside' })
      .normalize()
      .sharpen()
      .png()
      .toFile(optimizedPath);
    
    console.log('Imagen optimizada creada');
    
    // Procesar con OCR específico para dorsales
    const worker = await Tesseract.createWorker('eng');
    
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789',
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
    });
    
    const { data } = await worker.recognize(optimizedPath);
    
    console.log('\n=== TEXTO DETECTADO ===');
    console.log(data.text);
    
    console.log('\n=== PALABRAS DETECTADAS ===');
    if (data.words && data.words.length > 0) {
      data.words.forEach((word, index) => {
        if (word.text.match(/\d+/)) {
          console.log(`${index + 1}. "${word.text}" - Confianza: ${word.confidence.toFixed(2)}%`);
        }
      });
    } else {
      console.log('No se encontraron palabras individuales, pero el texto completo fue detectado.');
    }
    
    // Buscar específicamente 1431
    const dorsalPattern = /1431/g;
    const matches = data.text.match(dorsalPattern);
    
    if (matches) {
      console.log(`\n✅ DORSAL 1431 ENCONTRADO! - ${matches.length} coincidencias`);
    } else {
      console.log('\n❌ Dorsal 1431 no detectado directamente');
      
      // Buscar patrones similares
      const similarPatterns = data.text.match(/\b1\d{3}\b/g);
      if (similarPatterns) {
        console.log('Patrones similares encontrados:', similarPatterns);
      }
    }
    
    await worker.terminate();
    
  } catch (error) {
    console.error('Error procesando imagen:', error);
  }
}

// Función para procesar directamente la imagen subida
export async function testDirectImage(): Promise<void> {
  const imagePath = path.join(process.cwd(), 'attached_assets', 'Antrid-1015_1751318180994.jpg');
  await processSpecificImage(imagePath);
}

// Ejecutar automáticamente al importar el módulo
testDirectImage().catch(console.error);