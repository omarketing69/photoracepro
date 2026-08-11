import Tesseract from 'tesseract.js';
import fs from 'fs';
import path from 'path';
import { imagePreprocessor } from './image-preprocessing';

interface OCRResult {
  dorsalNumbers: number[];
  confidence: number;
  text: string;
}

export class RealOCRProcessor {
  private worker: Tesseract.Worker | null = null;

  async initialize() {
    if (this.worker) return;
    
    this.worker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        // Solo mostrar logs importantes
        if (m.status === 'recognizing text' && m.progress === 1) {
          console.log('OCR: Text recognition completed');
        }
      }
    });
    
    // Configurar Tesseract específicamente para dorsales de carreras
    await this.worker.setParameters({
      tessedit_char_whitelist: '0123456789',
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
      preserve_interword_spaces: '1',
      classify_bln_numeric_mode: '1'
    });
  }

  async processImage(imagePath: string): Promise<OCRResult> {
    try {
      if (!this.worker) {
        await this.initialize();
      }

      if (!fs.existsSync(imagePath)) {
        console.error('Image file not found:', imagePath);
        return { dorsalNumbers: [], confidence: 0, text: '' };
      }

      console.log(`Enhanced OCR processing for: ${imagePath}`);
      
      // Paso 1: Preprocesar la imagen con técnicas optimizadas para dorsales
      const preprocessedImages = await imagePreprocessor.preprocessForOCR(imagePath);
      
      // Solo usar la imagen original y las versiones preprocesadas (sin regiones por ahora)
      const allImages = [imagePath, ...preprocessedImages];
      
      let allDorsals: number[] = [];
      let bestConfidence = 0;
      let allText = '';
      
      // Paso 3: Procesar cada imagen/región con diferentes configuraciones OCR
      for (const imgPath of allImages) {
        if (!fs.existsSync(imgPath)) continue;
        
        // Configuración 1: Solo números, modo específico
        const result1 = await this.runOCRWithConfig(imgPath, {
          'tessedit_char_whitelist': '0123456789',
          'tessedit_pageseg_mode': '8', // Single word
          'tessedit_ocr_engine_mode': '1'
        });
        
        // Configuración 2: Modo automático
        const result2 = await this.runOCRWithConfig(imgPath, {
          'tessedit_pageseg_mode': '3', // Auto
          'tessedit_ocr_engine_mode': '1'
        });
        
        // Combinar resultados
        if (result1.dorsalNumbers.length > 0) {
          allDorsals = allDorsals.concat(result1.dorsalNumbers);
          bestConfidence = Math.max(bestConfidence, result1.confidence);
          allText += result1.text + ' ';
        }
        
        if (result2.dorsalNumbers.length > 0) {
          allDorsals = allDorsals.concat(result2.dorsalNumbers);
          bestConfidence = Math.max(bestConfidence, result2.confidence);
          allText += result2.text + ' ';
        }
      }
      
      // Limpiar archivos temporales
      await imagePreprocessor.cleanupTempFiles(preprocessedImages);
      
      // Eliminar duplicados y filtrar dorsales válidos
      const uniqueDorsals = Array.from(new Set(allDorsals))
        .filter(num => num >= 1 && num <= 5000)
        .sort((a, b) => a - b);
      
      console.log(`Enhanced OCR found ${uniqueDorsals.length} dorsals: ${uniqueDorsals.join(', ')}`);
      
      return {
        dorsalNumbers: uniqueDorsals,
        confidence: bestConfidence,
        text: allText.trim()
      };
      
    } catch (error) {
      console.error('Error in enhanced OCR processing:', error);
      return { dorsalNumbers: [], confidence: 0, text: '' };
    }
  }

  private async runOCRWithConfig(imagePath: string, config: any): Promise<OCRResult> {
    try {
      if (!this.worker) return { dorsalNumbers: [], confidence: 0, text: '' };
      
      // Solo configurar parámetros seguros que se pueden cambiar después de la inicialización
      const safeParams: any = {};
      if (config['tessedit_char_whitelist']) {
        safeParams['tessedit_char_whitelist'] = config['tessedit_char_whitelist'];
      }
      if (config['tessedit_pageseg_mode']) {
        safeParams['tessedit_pageseg_mode'] = config['tessedit_pageseg_mode'];
      }
      
      if (Object.keys(safeParams).length > 0) {
        await this.worker.setParameters(safeParams);
      }
      
      const { data } = await this.worker.recognize(imagePath);
      
      const text = data.text.trim();
      const dorsalNumbers = this.extractDorsalNumbers(text);
      
      return {
        dorsalNumbers,
        confidence: data.confidence / 100,
        text
      };
    } catch (error) {
      console.error('Error in OCR config:', error);
      return { dorsalNumbers: [], confidence: 0, text: '' };
    }
  }

  private extractDorsalNumbers(text: string): number[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    console.log('OCR text to analyze:', text);
    
    // Limpiar el texto manteniendo espacios y saltos de línea como separadores
    const cleanText = text.replace(/[^\d\s\n]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Buscar secuencias de dígitos que podrían ser dorsales completos
    // Priorizar números de 3-4 dígitos típicos en carreras
    const dorsalPattern = /\b\d{3,4}\b/g;
    const matches = cleanText.match(dorsalPattern) || [];
    
    // Filtrar dorsales válidos para carreras (rango típico 1-5000)
    let dorsals = matches
      .map(match => parseInt(match.trim(), 10))
      .filter(num => !isNaN(num) && num >= 100 && num <= 5000); // Priorizar dorsales de 3-4 dígitos
    
    // Si no encontramos dorsales de 3-4 dígitos, buscar también 1-2 dígitos
    if (dorsals.length === 0) {
      const shortPattern = /\b\d{1,2}\b/g;
      const shortMatches = cleanText.match(shortPattern) || [];
      dorsals = shortMatches
        .map(match => parseInt(match.trim(), 10))
        .filter(num => !isNaN(num) && num >= 1 && num <= 99);
    }
    
    // Eliminar duplicados y ordenar
    dorsals = Array.from(new Set(dorsals)).sort((a, b) => a - b);
    
    console.log('Extracted dorsals from OCR:', dorsals);
    return dorsals;
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

// Instancia global del procesador OCR
export const realOCRProcessor = new RealOCRProcessor();

// Función de conveniencia para procesar una imagen
export async function processImageWithRealOCR(imagePath: string): Promise<OCRResult> {
  return await realOCRProcessor.processImage(imagePath);
}