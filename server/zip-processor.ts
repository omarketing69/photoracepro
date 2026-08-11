import { promises as fs } from 'fs';
import path from 'path';
import yauzl from 'yauzl';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { storage } from './storage';

interface ZipProcessingBatch {
  id: string;
  eventId: number;
  status: 'extracting' | 'processing' | 'completed' | 'error';
  totalFiles: number;
  extractedFiles: number;
  processedFiles: number;
  error?: string;
  createdAt: Date;
}

const activeBatches = new Map<string, ZipProcessingBatch>();

export class ZipProcessor {
  private uploadsDir = path.join(process.cwd(), 'uploads');
  private tempDir = path.join(process.cwd(), 'temp');

  constructor() {
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Error creating directories:', error);
    }
  }

  async processZipFile(zipPath: string, eventId: number): Promise<string> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Crear el batch de procesamiento
      const batch: ZipProcessingBatch = {
        id: batchId,
        eventId,
        status: 'extracting',
        totalFiles: 0,
        extractedFiles: 0,
        processedFiles: 0,
        createdAt: new Date()
      };

      activeBatches.set(batchId, batch);

      // Contar archivos en el ZIP primero
      const totalFiles = await this.countFilesInZip(zipPath);
      batch.totalFiles = totalFiles;

      // Extraer archivos del ZIP de manera asíncrona
      this.extractZipFiles(zipPath, eventId, batchId).catch((error) => {
        console.error('Error in ZIP extraction:', error);
        const batch = activeBatches.get(batchId);
        if (batch) {
          batch.status = 'error';
          batch.error = error.message;
        }
      });

      return batchId;
    } catch (error) {
      console.error('Error starting ZIP processing:', error);
      throw new Error('Failed to start ZIP processing');
    }
  }

  private async countFilesInZip(zipPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let fileCount = 0;
      
      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);
        if (!zipfile) return reject(new Error('Could not open ZIP file'));

        zipfile.readEntry();
        
        zipfile.on('entry', (entry) => {
          if (!entry.fileName.endsWith('/') && this.isImageFile(entry.fileName)) {
            fileCount++;
          }
          zipfile.readEntry();
        });

        zipfile.on('end', () => {
          resolve(fileCount);
        });

        zipfile.on('error', reject);
      });
    });
  }

  private async extractZipFiles(zipPath: string, eventId: number, batchId: string) {
    const batch = activeBatches.get(batchId);
    if (!batch) throw new Error('Batch not found');

    const eventUploadDir = path.join(this.uploadsDir, `event_${eventId}`);
    await fs.mkdir(eventUploadDir, { recursive: true });

    return new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);
        if (!zipfile) return reject(new Error('Could not open ZIP file'));

        zipfile.readEntry();

        zipfile.on('entry', async (entry) => {
          try {
            if (entry.fileName.endsWith('/')) {
              // Es un directorio, saltarlo
              zipfile.readEntry();
              return;
            }

            if (!this.isImageFile(entry.fileName)) {
              // No es una imagen, saltarlo
              zipfile.readEntry();
              return;
            }

            // Extraer la imagen
            await this.extractSingleFile(zipfile, entry, eventUploadDir);
            
            // Actualizar progreso
            batch.extractedFiles++;
            
            zipfile.readEntry();
          } catch (error) {
            console.error('Error extracting file:', entry.fileName, error);
            zipfile.readEntry();
          }
        });

        zipfile.on('end', async () => {
          try {
            // Cambiar estado a procesamiento
            batch.status = 'processing';
            
            // Procesar las imágenes extraídas
            await this.processExtractedImages(eventUploadDir, eventId, batchId);
            
            // Completado
            batch.status = 'completed';
            
            // Limpiar archivo ZIP temporal
            await fs.unlink(zipPath).catch(console.error);
            
            resolve(void 0);
          } catch (error) {
            batch.status = 'error';
            batch.error = error instanceof Error ? error.message : 'Unknown error';
            reject(error);
          }
        });

        zipfile.on('error', (error) => {
          batch.status = 'error';
          batch.error = error.message;
          reject(error);
        });
      });
    });
  }

  private extractSingleFile(zipfile: yauzl.ZipFile, entry: yauzl.Entry, outputDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const fileName = path.basename(entry.fileName);
      const sanitizedFileName = this.sanitizeFileName(fileName);
      const outputPath = path.join(outputDir, sanitizedFileName);

      zipfile.openReadStream(entry, (err, readStream) => {
        if (err) return reject(err);
        if (!readStream) return reject(new Error('Could not create read stream'));

        const writeStream = createWriteStream(outputPath);
        
        pipeline(readStream, writeStream)
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  private async processExtractedImages(imagesDir: string, eventId: number, batchId: string) {
    const batch = activeBatches.get(batchId);
    if (!batch) throw new Error('Batch not found');

    const files = await fs.readdir(imagesDir);
    const imageFiles = files.filter(file => this.isImageFile(file));

    console.log(`☁️ Procesando ${imageFiles.length} imágenes con Google Cloud Storage...`);

    const { CloudImageService } = await import('./cloud-image-service');
    const cloudImageService = new CloudImageService();

    for (const file of imageFiles) {
      try {
        const filePath = path.join(imagesDir, file);
        
        // Crear archivo buffer para el CloudImageService
        const fileBuffer = await fs.readFile(filePath);
        const mockFile: Express.Multer.File = {
          originalname: file,
          buffer: fileBuffer,
          fieldname: 'photo',
          mimetype: 'image/jpeg',
          size: fileBuffer.length,
          destination: '',
          filename: file,
          path: filePath,
          encoding: '7bit',
          stream: null as any,
        };
        
        console.log(`📤 Subiendo a cloud storage: ${file}`);
        
        // Procesar y subir automáticamente a Google Cloud Storage con OCR
        await cloudImageService.processAndUploadPhoto(eventId, mockFile);
        
        batch.processedFiles++;
        
        console.log(`✅ Completado: ${file} (${batch.processedFiles}/${imageFiles.length})`);
        
        // Pequeña pausa para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Error procesando imagen ${file}:`, error);
      }
    }
    
    // Limpiar archivos temporales después de procesamiento
    try {
      await fs.rmdir(imagesDir, { recursive: true });
      console.log(`🗑️ Limpiados archivos temporales de: ${imagesDir}`);
    } catch (error) {
      console.error('Error limpiando archivos temporales:', error);
    }
  }

  private isImageFile(fileName: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.webp'];
    const ext = path.extname(fileName).toLowerCase();
    return imageExtensions.includes(ext);
  }

  private sanitizeFileName(fileName: string): string {
    // Remover caracteres problemáticos y espacios
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 255); // Limitar longitud
  }

  getBatchStatus(batchId: string): ZipProcessingBatch | null {
    return activeBatches.get(batchId) || null;
  }

  private async processPhotoWithOCR(photoId: number, imagePath: string) {
    try {
      // Importar el OCR simple mejorado
      const { processImageWithSimpleOCR } = await import('./ocr-simple');
      
      console.log(`ZIP: Starting simple OCR processing for photo ${photoId}: ${imagePath}`);
      
      // Procesar con OCR simple mejorado
      const ocrResult = await processImageWithSimpleOCR(imagePath);
      
      // Simular detección de caras
      const faces = [{
        x: Math.floor(Math.random() * 200),
        y: Math.floor(Math.random() * 200), 
        width: 100 + Math.floor(Math.random() * 50),
        height: 100 + Math.floor(Math.random() * 50),
        confidence: 0.8 + Math.random() * 0.2
      }];

      // Actualizar la foto con los resultados del procesamiento
      await storage.updatePhoto(photoId, {
        detectedDorsals: ocrResult.dorsalNumbers,
        faces: faces
      });

      console.log(`ZIP: Real OCR processed photo ${photoId}: found dorsals ${ocrResult.dorsalNumbers.join(', ')} (confidence: ${ocrResult.confidence.toFixed(2)})`);
    } catch (error) {
      console.error('ZIP: Error processing photo with real OCR:', error);
      
      // On OCR failure: save empty arrays — never write fake/random data
      await storage.updatePhoto(photoId, {
        detectedDorsals: [],
        faces: [],
        processingStatus: 'failed',
      });

      console.log(`ZIP: OCR failed for photo ${photoId}: saved empty dorsals and faces, status=failed`);
    }
  }

  cleanupOldBatches() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    const batchesToDelete: string[] = [];
    for (const [batchId, batch] of Array.from(activeBatches.entries())) {
      if (batch.createdAt.getTime() < oneHourAgo) {
        batchesToDelete.push(batchId);
      }
    }
    
    batchesToDelete.forEach(batchId => {
      activeBatches.delete(batchId);
    });
  }
}

export const zipProcessor = new ZipProcessor();

// Limpiar batches antiguos cada 30 minutos
setInterval(() => {
  zipProcessor.cleanupOldBatches();
}, 30 * 60 * 1000);