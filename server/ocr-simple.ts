import Tesseract from 'tesseract.js';
import fs from 'fs';
import path from 'path';

interface SimpleOCRResult {
  dorsalNumbers: number[];
  confidence: number;
  text: string;
}

export class SimpleOCRProcessor {
  private worker: Tesseract.Worker | null = null;

  async initialize() {
    if (this.worker) return;
    
    this.worker = await Tesseract.createWorker('eng', 1, {
      logger: () => {} // Sin logs para simplificar
    });
    
    // Configuración específica para dorsales de carreras - modo más agresivo
    await this.worker.setParameters({
      tessedit_char_whitelist: '0123456789',
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
      // Configuraciones adicionales para mejor detección
      tessedit_write_images: '0',
      user_defined_dpi: '300',
      textord_really_old_xheight: '1',
      textord_min_xheight: '10',
      // Configuraciones para números pequeños
      classify_enable_learning: '0',
      classify_enable_adaptive_matcher: '1'
    });
  }

  async processImage(imagePath: string): Promise<SimpleOCRResult> {
    try {
      if (!this.worker) {
        await this.initialize();
      }

      if (!fs.existsSync(imagePath)) {
        console.error('Image file not found:', imagePath);
        return { dorsalNumbers: [], confidence: 0, text: '' };
      }

      console.log(`Advanced OCR processing with image preprocessing: ${imagePath}`);
      
      // Importar el preprocesador avanzado
      const { advancedImagePreprocessor } = await import('./image-preprocessing-advanced');
      
      // Generar múltiples versiones preprocesadas de la imagen
      const preprocessedImages = await advancedImagePreprocessor.preprocessForOCR(imagePath);
      
      // Configuraciones OCR optimizadas
      const configs = [
        { name: 'AUTO', psm: Tesseract.PSM.AUTO },
        { name: 'SINGLE_BLOCK', psm: Tesseract.PSM.SINGLE_BLOCK },
        { name: 'SINGLE_WORD', psm: Tesseract.PSM.SINGLE_WORD }
      ];

      let bestResult: SimpleOCRResult = { dorsalNumbers: [], confidence: 0, text: '' };
      let allDetectedDorsals = new Set<number>();
      
      // Probar cada imagen preprocesada con cada configuración OCR
      for (const imageVersion of preprocessedImages) {
        for (const config of configs) {
          try {
            await this.worker!.setParameters({
              tessedit_pageseg_mode: config.psm
            });
            
            const { data } = await this.worker!.recognize(imageVersion);
            const text = data.text.trim();
            const dorsalNumbers = this.extractDorsals(text);
            
            // Agregar todos los dorsales detectados al conjunto global
            dorsalNumbers.forEach(dorsal => allDetectedDorsals.add(dorsal));
            
            console.log(`OCR ${config.name} on ${path.basename(imageVersion)}: found ${dorsalNumbers.length} dorsals`);
            
            // Actualizar el mejor resultado si este tiene mejor calidad
            if (dorsalNumbers.length > bestResult.dorsalNumbers.length || 
                (dorsalNumbers.length === bestResult.dorsalNumbers.length && data.confidence > bestResult.confidence * 100)) {
              bestResult = {
                dorsalNumbers,
                confidence: data.confidence / 100,
                text: text
              };
            }
          } catch (configError) {
            console.error(`Error with config ${config.name} on ${imageVersion}:`, configError);
          }
        }
      }
      
      // Usar todos los dorsales únicos detectados en todas las versiones
      const finalDorsals = Array.from(allDetectedDorsals).sort((a, b) => a - b);
      
      const finalResult: SimpleOCRResult = {
        dorsalNumbers: finalDorsals,
        confidence: bestResult.confidence,
        text: bestResult.text
      };
      
      console.log(`Final OCR result: ${finalDorsals.length} unique dorsals detected`);
      
      // Limpiar archivos temporales
      await advancedImagePreprocessor.cleanupTempFiles(preprocessedImages);
      
      return finalResult;
      
    } catch (error) {
      console.error('Error in advanced OCR processing:', error);
      return { dorsalNumbers: [], confidence: 0, text: '' };
    }
  }

  private extractDorsals(text: string): number[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    console.log('Analyzing text for dorsals:', text);
    
    // Limpiar y normalizar el texto más agresivamente
    let cleanText = text.replace(/[^\d\s\n]/g, ' ');
    cleanText = cleanText.replace(/\s+/g, ' ').trim();
    
    console.log('Cleaned text:', cleanText);
    
    // Intentar formar números de 4 dígitos de dígitos consecutivos
    const digits = cleanText.replace(/\s/g, '').split('');
    console.log('Individual digits found:', digits);
    
    let dorsals: number[] = [];
    
    // 1. Buscar dorsales de 4 dígitos completos
    const fourDigitPattern = /\b\d{4}\b/g;
    const fourDigitMatches = cleanText.match(fourDigitPattern) || [];
    dorsals.push(...fourDigitMatches.map(match => parseInt(match, 10)));
    
    // 2. Buscar dorsales de 3 dígitos
    const threeDigitPattern = /\b\d{3}\b/g;
    const threeDigitMatches = cleanText.match(threeDigitPattern) || [];
    dorsals.push(...threeDigitMatches.map(match => parseInt(match, 10)));
    
    // 3. Intentar formar dorsales de 4 dígitos de dígitos separados
    if (digits.length >= 4) {
      for (let i = 0; i <= digits.length - 4; i++) {
        const fourDigitNumber = digits.slice(i, i + 4).join('');
        if (/^\d{4}$/.test(fourDigitNumber)) {
          const num = parseInt(fourDigitNumber, 10);
          if (num >= 1000 && num <= 9999) {
            dorsals.push(num);
            console.log(`Formed 4-digit dorsal from separated digits: ${num}`);
          }
        }
      }
    }
    
    // 4. Como respaldo, buscar números de 1-2 dígitos
    if (dorsals.length === 0) {
      const shortPattern = /\b\d{1,2}\b/g;
      const shortMatches = cleanText.match(shortPattern) || [];
      dorsals.push(...shortMatches
        .map(match => parseInt(match, 10))
        .filter(num => num >= 1 && num <= 99));
    }
    
    // Filtrar dorsales válidos para carreras (1-9999)
    dorsals = dorsals.filter(num => num >= 1 && num <= 9999);
    
    // Eliminar duplicados y ordenar
    dorsals = Array.from(new Set(dorsals)).sort((a, b) => a - b);
    
    console.log('Simple OCR extracted dorsals:', dorsals);
    return dorsals;
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

export const simpleOCRProcessor = new SimpleOCRProcessor();

export async function processImageWithSimpleOCR(imagePath: string): Promise<SimpleOCRResult> {
  return await simpleOCRProcessor.processImage(imagePath);
}