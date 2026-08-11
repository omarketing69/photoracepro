import { getCloudStorage } from './cloud-storage';
import { GoogleVisionOCRProcessor } from './google-vision-ocr';
import fs from 'fs';
import path from 'path';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { photos } from '@shared/schema';

export class CloudOCRProcessor {
  private ocrProcessor: GoogleVisionOCRProcessor;
  private cloudStorage: ReturnType<typeof getCloudStorage>;
  private tempDir: string;

  constructor() {
    this.ocrProcessor = new GoogleVisionOCRProcessor();
    this.cloudStorage = getCloudStorage();
    this.tempDir = path.join(process.cwd(), 'temp-ocr');
    
    // Crear directorio temporal si no existe
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async processPhotoFromCloud(photoId: number): Promise<{
    dorsalNumbers: number[];
    confidence: number;
    text: string;
  }> {
    try {
      console.log(`🔍 Procesando foto ${photoId} desde Google Cloud Storage`);
      
      // Obtener información de la foto
      const photo = await db
        .select()
        .from(photos)
        .where(eq(photos.id, photoId))
        .limit(1);
      
      if (photo.length === 0) {
        throw new Error(`Foto ${photoId} no encontrada`);
      }
      
      const photoRecord = photo[0];
      console.log(`📸 Procesando: ${photoRecord.filename}`);
      console.log(`📂 Path original: ${photoRecord.originalPath}`);
      
      // Verificar si el archivo existe en Google Cloud Storage
      const file = this.cloudStorage.storage.bucket(this.cloudStorage.bucketName).file(photoRecord.originalPath);
      const [exists] = await file.exists();
      
      if (!exists) {
        throw new Error(`Archivo no encontrado en Google Cloud Storage: ${photoRecord.originalPath}`);
      }
      
      // Descargar el archivo temporalmente
      const [buffer] = await file.download();
      console.log(`📥 Archivo descargado: ${buffer.length} bytes`);
      
      // Crear archivo temporal con nombre seguro (solo filename, sin path)
      const justFileName = path.basename(photoRecord.filename);
      const safeFileName = justFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const tempFileName = `temp_${Date.now()}_${safeFileName}`;
      const tempFilePath = path.join(this.tempDir, tempFileName);
      
      // Asegurar que el directorio temporal existe
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }
      
      fs.writeFileSync(tempFilePath, buffer);
      
      try {
        // Procesar con Google Vision OCR
        console.log('🔄 Procesando con Google Vision OCR...');
        const result = await this.ocrProcessor.processImage(tempFilePath);
        
        console.log(`✅ OCR completado para foto ${photoId}`);
        console.log(`   Dorsales detectados: ${JSON.stringify(result.dorsalNumbers)}`);
        console.log(`   Confianza: ${result.confidence}`);
        
        // Actualizar la foto en la base de datos
        await db
          .update(photos)
          .set({
            detectedDorsals: result.dorsalNumbers,
            processed: true,
            processingStatus: 'completed',
            processedAt: new Date()
          })
          .where(eq(photos.id, photoId));
        
        console.log(`✅ Foto ${photoId} actualizada en base de datos`);
        
        return {
          dorsalNumbers: result.dorsalNumbers,
          confidence: result.confidence,
          text: result.allText
        };
        
      } finally {
        // Limpiar archivo temporal
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error procesando foto ${photoId}:`, error);
      throw error;
    }
  }

  async processAllPhotosWithoutDorsals(eventId: number = 1): Promise<{
    processed: number;
    failed: number;
    dorsalsDetected: number;
  }> {
    try {
      console.log(`🔄 Procesando todas las fotos sin dorsales del evento ${eventId}`);
      
      // Obtener fotos sin dorsales detectados
      const photosWithoutDorsals = await db
        .select()
        .from(photos)
        .where(eq(photos.eventId, eventId));
      
      const photosToProcess = photosWithoutDorsals.filter(photo => 
        !photo.detectedDorsals || photo.detectedDorsals.length === 0
      );
      
      console.log(`📊 Fotos sin dorsales: ${photosToProcess.length}`);
      
      let processed = 0;
      let failed = 0;
      let totalDorsalsDetected = 0;
      
      // Procesar en lotes pequeños para evitar sobrecarga
      const batchSize = 5;
      
      for (let i = 0; i < photosToProcess.length; i += batchSize) {
        const batch = photosToProcess.slice(i, i + batchSize);
        
        console.log(`🔄 Procesando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(photosToProcess.length / batchSize)}`);
        
        const batchPromises = batch.map(async (photo) => {
          try {
            const result = await this.processPhotoFromCloud(photo.id);
            processed++;
            totalDorsalsDetected += result.dorsalNumbers.length;
            return { success: true, photo: photo.id, dorsals: result.dorsalNumbers.length };
          } catch (error) {
            failed++;
            console.error(`❌ Error procesando foto ${photo.id}:`, error);
            return { success: false, photo: photo.id, error: error.message };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        // Mostrar resultados del lote
        batchResults.forEach(result => {
          if (result.success) {
            console.log(`   ✅ Foto ${result.photo}: ${result.dorsals} dorsales`);
          } else {
            console.log(`   ❌ Foto ${result.photo}: ${result.error}`);
          }
        });
        
        // Pausa entre lotes para evitar sobrecarga
        if (i + batchSize < photosToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      console.log(`✅ Procesamiento completado:`);
      console.log(`   📸 Fotos procesadas: ${processed}`);
      console.log(`   ❌ Fotos fallidas: ${failed}`);
      console.log(`   🏃 Dorsales detectados: ${totalDorsalsDetected}`);
      
      return {
        processed,
        failed,
        dorsalsDetected: totalDorsalsDetected
      };
      
    } catch (error) {
      console.error('❌ Error en procesamiento masivo:', error);
      throw error;
    }
  }

  async cleanupTempFiles(): Promise<void> {
    try {
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        for (const file of files) {
          const filePath = path.join(this.tempDir, file);
          fs.unlinkSync(filePath);
        }
        console.log(`🧹 Limpiados ${files.length} archivos temporales`);
      }
    } catch (error) {
      console.error('❌ Error limpiando archivos temporales:', error);
    }
  }
}

export const cloudOCRProcessor = new CloudOCRProcessor();