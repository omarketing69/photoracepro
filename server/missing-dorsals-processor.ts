import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { storage } from './storage';

export class MissingDorsalsProcessor {
  private missingDorsals = [1148, 1544, 1183, 1354]; // Dorsales que el usuario busca pero no encuentra

  async processMissingDorsals(): Promise<void> {
    console.log('🔍 PROCESANDO DORSALES FALTANTES:', this.missingDorsals.join(', '));
    
    const photos = await storage.getPhotos(1);
    console.log(`📸 Procesando ${photos.length} fotos`);
    
    for (const photo of photos) {
      await this.processPhotoForMissingDorsals(photo);
    }
    
    console.log('✅ Procesamiento de dorsales faltantes completado');
  }

  private async processPhotoForMissingDorsals(photo: any): Promise<void> {
    try {
      console.log(`\n📷 Procesando: ${photo.filename}`);
      
      if (!fs.existsSync(photo.originalPath)) {
        console.log(`❌ Archivo no encontrado: ${photo.originalPath}`);
        return;
      }
      
      // Crear versiones optimizadas específicamente para dorsales faltantes
      const tempDir = path.join(process.cwd(), 'temp', 'missing');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const versions = await this.createOptimizedVersions(photo.originalPath, tempDir, photo.filename);
      
      const worker = await Tesseract.createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
      });
      
      const allNumbers = new Set<number>();
      
      // Procesar cada versión optimizada
      for (const version of versions) {
        const { data } = await worker.recognize(version.path);
        const text = data.text.replace(/\s+/g, ' ').trim();
        
        // Extraer números de 3-4 dígitos
        const numbers = text.match(/\b\d{3,4}\b/g) || [];
        numbers.forEach(numStr => {
          const num = parseInt(numStr);
          if (num >= 1000 && num <= 9999) {
            allNumbers.add(num);
          }
        });
        
        console.log(`  ${version.name}: [${numbers.join(', ')}]`);
      }
      
      await worker.terminate();
      
      // Verificar si encontramos dorsales faltantes
      const foundMissingDorsals = this.missingDorsals.filter(dorsal => allNumbers.has(dorsal));
      const allFoundDorsals = Array.from(allNumbers);
      
      if (foundMissingDorsals.length > 0) {
        console.log(`🎯 DORSALES FALTANTES ENCONTRADOS: ${foundMissingDorsals.join(', ')}`);
      }
      
      if (allFoundDorsals.length > 0) {
        // Combinar con dorsales existentes
        const existingDorsals = photo.detectedDorsals || [];
        const combinedDorsals = [...new Set([...existingDorsals, ...allFoundDorsals])];
        
        await storage.updatePhoto(photo.id, {
          detectedDorsals: combinedDorsals,
          processed: true,
          processingStatus: 'completed'
        });
        
        console.log(`✅ Actualizado: ${allFoundDorsals.join(', ')} (total: ${combinedDorsals.length})`);
      }
      
      // Limpiar archivos temporales
      versions.forEach(v => {
        try {
          if (fs.existsSync(v.path)) fs.unlinkSync(v.path);
        } catch (error) {
          // Ignore cleanup errors
        }
      });
      
    } catch (error) {
      console.error(`❌ Error procesando ${photo.filename}:`, error);
    }
  }

  private async createOptimizedVersions(imagePath: string, tempDir: string, filename: string) {
    const versions = [];
    const baseName = path.parse(filename).name;
    
    try {
      // Versión 1: Máximo contraste para números blancos
      const v1Path = path.join(tempDir, `${baseName}_contrast.png`);
      await sharp(imagePath)
        .resize(1800, 1200, { fit: 'inside' })
        .grayscale()
        .normalize()
        .linear(4.0, -300)
        .threshold(180)
        .png()
        .toFile(v1Path);
      versions.push({ path: v1Path, name: 'Alto-Contraste' });
      
      // Versión 2: Enfoque en centro (área típica de dorsales)
      const v2Path = path.join(tempDir, `${baseName}_center.png`);
      const metadata = await sharp(imagePath).metadata();
      const cropSize = Math.min(metadata.width || 1000, metadata.height || 1000) * 0.6;
      const startX = Math.max(0, ((metadata.width || 1000) - cropSize) / 2);
      const startY = Math.max(0, ((metadata.height || 1000) - cropSize) / 2);
      
      await sharp(imagePath)
        .extract({ 
          left: Math.floor(startX), 
          top: Math.floor(startY), 
          width: Math.floor(cropSize), 
          height: Math.floor(cropSize) 
        })
        .resize(1200, 1200)
        .grayscale()
        .sharpen({ sigma: 1.5 })
        .normalize()
        .linear(2.5, -100)
        .png()
        .toFile(v2Path);
      versions.push({ path: v2Path, name: 'Centro-Enfocado' });
      
      // Versión 3: Ultra resolución con detección de bordes
      const v3Path = path.join(tempDir, `${baseName}_edges.png`);
      await sharp(imagePath)
        .resize(2000, 1500, { fit: 'inside' })
        .grayscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
        })
        .normalize()
        .threshold(120)
        .png()
        .toFile(v3Path);
      versions.push({ path: v3Path, name: 'Detección-Bordes' });
      
    } catch (error) {
      console.error('Error creando versiones optimizadas:', error);
    }
    
    return versions;
  }
}

export const missingDorsalsProcessor = new MissingDorsalsProcessor();