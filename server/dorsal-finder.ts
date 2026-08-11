import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';
import { storage } from './storage';

export class DorsalFinder {
  private targetDorsals = [1148, 1544, 1431, 1531, 1253]; // Dorsales que sabemos que existen

  async findSpecificDorsals(): Promise<void> {
    console.log('=== BÚSQUEDA ESPECÍFICA DE DORSALES ===');
    console.log('Dorsales objetivo:', this.targetDorsals.join(', '));
    
    const photos = await storage.getPhotos(1); // Evento 1
    
    for (const photo of photos) {
      console.log(`\nProcesando: ${photo.filename}`);
      
      // Si ya tiene dorsales detectados, verificar si contiene alguno de nuestros objetivos
      if (photo.detectedDorsals && photo.detectedDorsals.length > 0) {
        const foundTargets = photo.detectedDorsals.filter(d => this.targetDorsals.includes(d));
        if (foundTargets.length > 0) {
          console.log(`✅ Ya detectados: ${foundTargets.join(', ')}`);
          continue;
        }
      }
      
      // Procesar con técnicas agresivas para encontrar dorsales específicos
      await this.aggressiveSearch(photo.id, photo.originalPath, photo.filename);
    }
  }

  private async aggressiveSearch(photoId: number, imagePath: string, filename: string): Promise<void> {
    try {
      const tempDir = path.join(process.cwd(), 'temp', 'aggressive');
      
      // Crear múltiples versiones ultra-optimizadas
      const versions = await this.createAggressiveVersions(imagePath, tempDir, filename);
      
      const worker = await Tesseract.createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
      });
      
      const allDetectedNumbers = new Set<string>();
      
      for (const version of versions) {
        const { data } = await worker.recognize(version.path);
        const text = data.text.replace(/\s+/g, ' ').trim();
        
        // Extraer todos los números de 3-4 dígitos
        const numbers = text.match(/\b\d{3,4}\b/g) || [];
        numbers.forEach(num => allDetectedNumbers.add(num));
        
        console.log(`${version.name}: "${text}" -> [${numbers.join(', ')}]`);
      }
      
      await worker.terminate();
      
      // Buscar nuestros dorsales objetivo en los números detectados
      const foundDorsals: number[] = [];
      for (const numStr of allDetectedNumbers) {
        const num = parseInt(numStr);
        if (this.targetDorsals.includes(num)) {
          foundDorsals.push(num);
          console.log(`🎯 DORSAL OBJETIVO ENCONTRADO: ${num}`);
        }
      }
      
      // Actualizar base de datos si encontramos dorsales
      if (foundDorsals.length > 0) {
        await storage.updatePhoto(photoId, {
          detectedDorsals: foundDorsals,
          processed: true,
          processingStatus: 'completed'
        });
        console.log(`✅ Actualizado en BD: ${foundDorsals.join(', ')}`);
      }
      
    } catch (error) {
      console.error(`Error en búsqueda agresiva para ${filename}:`, error);
    }
  }

  private async createAggressiveVersions(imagePath: string, tempDir: string, baseFilename: string) {
    const versions = [];
    
    try {
      // Versión 1: Ultra alta resolución con contraste extremo
      const v1Path = path.join(tempDir, `${baseFilename}_ultra.png`);
      await sharp(imagePath)
        .resize(2400, 1800, { fit: 'inside' })
        .grayscale()
        .normalize()
        .linear(3.0, -200)
        .sharpen({ sigma: 2 })
        .png()
        .toFile(v1Path);
      versions.push({ path: v1Path, name: 'Ultra-Resolución' });
      
      // Versión 2: Binario extremo para números blancos
      const v2Path = path.join(tempDir, `${baseFilename}_binary.png`);
      await sharp(imagePath)
        .resize(1800, 1350, { fit: 'inside' })
        .grayscale()
        .threshold(200)
        .png()
        .toFile(v2Path);
      versions.push({ path: v2Path, name: 'Binario-Extremo' });
      
      // Versión 3: Enfoque en área del pecho (donde suelen estar los dorsales)
      const v3Path = path.join(tempDir, `${baseFilename}_chest.png`);
      const metadata = await sharp(imagePath).metadata();
      const cropHeight = Math.floor((metadata.height || 1000) * 0.4);
      const cropY = Math.floor((metadata.height || 1000) * 0.2);
      
      await sharp(imagePath)
        .extract({ left: 0, top: cropY, width: metadata.width || 1000, height: cropHeight })
        .resize(1200, 800, { fit: 'inside' })
        .grayscale()
        .normalize()
        .sharpen()
        .linear(2.5, -150)
        .png()
        .toFile(v3Path);
      versions.push({ path: v3Path, name: 'Área-Pecho' });
      
    } catch (error) {
      console.error('Error creando versiones agresivas:', error);
    }
    
    return versions;
  }
}

export const dorsalFinder = new DorsalFinder();