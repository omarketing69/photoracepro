import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';

export async function extractSpecificDorsals(imagePath: string, expectedDorsals: number[]): Promise<number[]> {
  try {
    console.log(`\n=== EXTRAYENDO DORSALES DE: ${imagePath} ===`);
    console.log(`Dorsales esperados: ${expectedDorsals.join(', ')}`);
    
    // Crear múltiples versiones procesadas
    const tempDir = path.join(process.cwd(), 'temp');
    const versions = [];
    
    // Versión 1: Alta resolución y contraste
    const v1Path = path.join(tempDir, 'extract_v1.png');
    await sharp(imagePath)
      .resize(1600, 1200, { fit: 'inside' })
      .grayscale()
      .normalize()
      .sharpen()
      .modulate({ brightness: 1.2, contrast: 1.5 })
      .png()
      .toFile(v1Path);
    versions.push(v1Path);
    
    // Versión 2: Binaria con umbral alto
    const v2Path = path.join(tempDir, 'extract_v2.png');
    await sharp(imagePath)
      .resize(1200, 900, { fit: 'inside' })
      .grayscale()
      .threshold(150)
      .png()
      .toFile(v2Path);
    versions.push(v2Path);
    
    // Versión 3: Solo números blancos
    const v3Path = path.join(tempDir, 'extract_v3.png');
    await sharp(imagePath)
      .resize(1400, 1050, { fit: 'inside' })
      .grayscale()
      .normalize()
      .linear(2.0, -128)
      .threshold(180)
      .png()
      .toFile(v3Path);
    versions.push(v3Path);
    
    const worker = await Tesseract.createWorker('eng');
    
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789',
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
    });
    
    const detectedDorsals = new Set<number>();
    
    for (const versionPath of versions) {
      console.log(`Procesando versión: ${path.basename(versionPath)}`);
      
      const { data } = await worker.recognize(versionPath);
      const text = data.text.replace(/\s+/g, ' ').trim();
      
      console.log(`Texto detectado: "${text}"`);
      
      // Buscar dorsales de 4 dígitos
      const fourDigitMatches = text.match(/\b\d{4}\b/g);
      if (fourDigitMatches) {
        fourDigitMatches.forEach(match => {
          const dorsal = parseInt(match);
          if (expectedDorsals.includes(dorsal)) {
            detectedDorsals.add(dorsal);
            console.log(`✅ DORSAL ENCONTRADO: ${dorsal}`);
          }
        });
      }
      
      // También buscar patrones específicos para cada dorsal esperado
      expectedDorsals.forEach(expectedDorsal => {
        const dorsalStr = expectedDorsal.toString();
        if (text.includes(dorsalStr)) {
          detectedDorsals.add(expectedDorsal);
          console.log(`✅ DORSAL ENCONTRADO POR PATRÓN: ${expectedDorsal}`);
        }
      });
    }
    
    await worker.terminate();
    
    const result = Array.from(detectedDorsals);
    console.log(`Dorsales extraídos: ${result.join(', ')}`);
    
    return result;
    
  } catch (error) {
    console.error('Error extrayendo dorsales:', error);
    return [];
  }
}

export async function processAndStoreDorsals(imagePath: string, filename: string, expectedDorsals: number[]): Promise<void> {
  const detectedDorsals = await extractSpecificDorsals(imagePath, expectedDorsals);
  
  if (detectedDorsals.length > 0) {
    // Agregar a la base de datos
    const { storage } = await import('./storage');
    
    const photo = await storage.createPhoto({
      eventId: 1,
      filename,
      originalPath: imagePath,
      detectedDorsals,
      processed: true,
      processingStatus: 'completed'
    });
    
    console.log(`✅ Foto guardada en BD: ID ${photo.id}, Dorsales: ${detectedDorsals.join(', ')}`);
  } else {
    console.log('❌ No se detectaron dorsales esperados');
  }
}