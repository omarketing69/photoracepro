import { db } from './db';
import { photos } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { getCloudStorage } from './cloud-storage';

export interface UploadSession {
  id: string;
  eventId: number;
  totalFiles: number;
  processedFiles: string[];
  failedFiles: string[];
  skippedFiles: string[];
  status: 'active' | 'completed' | 'failed' | 'paused';
  createdAt: Date;
  lastActivity: Date;
}

export interface FileResult {
  filename: string;
  status: 'success' | 'error' | 'skipped' | 'duplicate';
  photoId?: number;
  error?: string;
  dorsalsDetected?: number;
}

class UploadResumeSystem {
  private activeSessions = new Map<string, UploadSession>();
  private cloudStorage = getCloudStorage();

  /**
   * Crear nueva sesión de subida
   */
  createSession(eventId: number, filenames: string[]): UploadSession {
    const sessionId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: UploadSession = {
      id: sessionId,
      eventId,
      totalFiles: filenames.length,
      processedFiles: [],
      failedFiles: [],
      skippedFiles: [],
      status: 'active',
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  /**
   * Obtener sesión activa
   */
  getSession(sessionId: string): UploadSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Verificar si un archivo ya existe en la base de datos
   */
  async checkDuplicateFile(eventId: number, filename: string): Promise<boolean> {
    try {
      const existingPhotos = await db
        .select({ id: photos.id })
        .from(photos)
        .where(and(
          eq(photos.eventId, eventId),
          eq(photos.filename, filename)
        ));

      const isDuplicate = existingPhotos.length > 0;
      
      if (isDuplicate) {
        console.log(`🚨 DUPLICADO DETECTADO EN BASE DE DATOS: ${filename} (${existingPhotos.length} registros existentes)`);
        existingPhotos.forEach(photo => {
          console.log(`   - ID existente: ${photo.id}`);
        });
      }

      return isDuplicate;
    } catch (error) {
      console.error('Error checking duplicate file:', error);
      return false;
    }
  }

  /**
   * Verificar si un archivo ya existe en Google Cloud Storage
   */
  async checkDuplicateInCloud(eventId: number, filename: string): Promise<boolean> {
    try {
      const cloudFilename = `eventos/${eventId}/originales/${filename}`;
      
      // Verificar si el archivo ya existe en Google Cloud Storage
      const bucket = this.cloudStorage['storage'].bucket(this.cloudStorage['bucketName']);
      const file = bucket.file(cloudFilename);
      const [exists] = await file.exists();
      
      if (exists) {
        console.log(`🚨 DUPLICADO DETECTADO EN GOOGLE CLOUD STORAGE: ${filename} (${cloudFilename})`);
      }
      
      return exists;
    } catch (error) {
      console.error('Error checking duplicate in cloud:', error);
      return false;
    }
  }

  /**
   * Verificar duplicados tanto en base de datos como en la nube
   */
  async checkAllDuplicates(eventId: number, filename: string): Promise<{
    isDuplicate: boolean;
    inDatabase: boolean;
    inCloud: boolean;
  }> {
    console.log(`🔍 Verificando duplicados para: ${filename} en evento ${eventId}`);
    
    const [inDatabase, inCloud] = await Promise.all([
      this.checkDuplicateFile(eventId, filename),
      this.checkDuplicateInCloud(eventId, filename)
    ]);

    const isDuplicate = inDatabase || inCloud;
    
    console.log(`🔍 Resultado duplicado para ${filename}:`);
    console.log(`   - Base de datos: ${inDatabase}`);
    console.log(`   - Google Cloud: ${inCloud}`);
    console.log(`   - Es duplicado: ${isDuplicate}`);

    return {
      isDuplicate,
      inDatabase,
      inCloud
    };
  }

  /**
   * Validar que el sistema de prevención de duplicados funciona correctamente
   */
  async validateDuplicatePreventionSystem(eventId: number): Promise<{
    isWorking: boolean;
    testResults: {
      databaseCheck: boolean;
      cloudCheck: boolean;
      combinedCheck: boolean;
    };
    recommendations: string[];
  }> {
    console.log(`🧪 VALIDANDO SISTEMA DE PREVENCIÓN DE DUPLICADOS`);
    
    const recommendations: string[] = [];
    
    // Buscar una foto existente para probar
    const existingPhoto = await db
      .select()
      .from(photos)
      .where(eq(photos.eventId, eventId))
      .limit(1);
    
    if (existingPhoto.length === 0) {
      return {
        isWorking: false,
        testResults: {
          databaseCheck: false,
          cloudCheck: false,
          combinedCheck: false
        },
        recommendations: ['No hay fotos existentes para probar el sistema']
      };
    }
    
    const testFilename = existingPhoto[0].filename;
    console.log(`🧪 Usando foto existente para prueba: ${testFilename}`);
    
    // Probar detección en base de datos
    const databaseCheck = await this.checkDuplicateFile(eventId, testFilename);
    console.log(`🧪 Base de datos detectó duplicado: ${databaseCheck}`);
    
    // Probar detección en Google Cloud
    const cloudCheck = await this.checkDuplicateInCloud(eventId, testFilename);
    console.log(`🧪 Google Cloud detectó duplicado: ${cloudCheck}`);
    
    // Probar verificación combinada
    const combinedResult = await this.checkAllDuplicates(eventId, testFilename);
    console.log(`🧪 Verificación combinada: ${combinedResult.isDuplicate}`);
    
    // Analizar resultados
    if (!databaseCheck) {
      recommendations.push('CRÍTICO: Sistema no detecta duplicados en base de datos');
    }
    
    if (!cloudCheck) {
      recommendations.push('ADVERTENCIA: Sistema no detecta duplicados en Google Cloud Storage');
    }
    
    if (!combinedResult.isDuplicate) {
      recommendations.push('CRÍTICO: Sistema combinado no detecta duplicados');
    }
    
    const isWorking = databaseCheck && combinedResult.isDuplicate;
    
    console.log(`🧪 RESULTADO: Sistema ${isWorking ? 'FUNCIONANDO' : 'FALLANDO'}`);
    
    return {
      isWorking,
      testResults: {
        databaseCheck,
        cloudCheck,
        combinedCheck: combinedResult.isDuplicate
      },
      recommendations
    };
  }

  /**
   * Obtener archivos que se pueden procesar (no duplicados)
   */
  async getFilesToProcess(eventId: number, files: Express.Multer.File[]): Promise<{
    toProcess: Express.Multer.File[];
    duplicates: Express.Multer.File[];
    duplicateDetails: Array<{
      filename: string;
      inDatabase: boolean;
      inCloud: boolean;
    }>;
  }> {
    const toProcess: Express.Multer.File[] = [];
    const duplicates: Express.Multer.File[] = [];
    const duplicateDetails: Array<{
      filename: string;
      inDatabase: boolean;
      inCloud: boolean;
    }> = [];

    console.log(`🔍 ================================`);
    console.log(`🔍 VERIFICANDO DUPLICADOS PARA ${files.length} ARCHIVOS EN EVENTO ${eventId}`);
    console.log(`🔍 ================================`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`🔍 [${i + 1}/${files.length}] Verificando: ${file.originalname}`);
      
      const duplicateStatus = await this.checkAllDuplicates(eventId, file.originalname);
      
      if (duplicateStatus.isDuplicate) {
        duplicates.push(file);
        duplicateDetails.push({
          filename: file.originalname,
          inDatabase: duplicateStatus.inDatabase,
          inCloud: duplicateStatus.inCloud
        });
        console.log(`🚨 DUPLICADO DETECTADO: ${file.originalname}`);
        console.log(`   - En base de datos: ${duplicateStatus.inDatabase}`);
        console.log(`   - En Google Cloud: ${duplicateStatus.inCloud}`);
      } else {
        toProcess.push(file);
        console.log(`✅ ARCHIVO NUEVO: ${file.originalname}`);
      }
    }

    console.log(`🔍 ================================`);
    console.log(`🔍 RESUMEN DE VERIFICACIÓN:`);
    console.log(`   - Archivos a procesar: ${toProcess.length}`);
    console.log(`   - Duplicados detectados: ${duplicates.length}`);
    console.log(`🔍 ================================`);
    
    return { toProcess, duplicates, duplicateDetails };
  }

  /**
   * Actualizar progreso de sesión
   */
  updateSessionProgress(sessionId: string, filename: string, result: FileResult): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.lastActivity = new Date();

    switch (result.status) {
      case 'success':
        session.processedFiles.push(filename);
        break;
      case 'error':
        session.failedFiles.push(filename);
        break;
      case 'skipped':
      case 'duplicate':
        session.skippedFiles.push(filename);
        break;
    }

    // Verificar si la sesión está completada
    const totalProcessed = session.processedFiles.length + session.failedFiles.length + session.skippedFiles.length;
    if (totalProcessed >= session.totalFiles) {
      session.status = 'completed';
    }
  }

  /**
   * Marcar sesión como fallida
   */
  markSessionFailed(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = 'failed';
      session.lastActivity = new Date();
    }
  }

  /**
   * Obtener archivos restantes para procesar en una sesión
   */
  getRemainingFiles(sessionId: string, allFiles: Express.Multer.File[]): Express.Multer.File[] {
    const session = this.activeSessions.get(sessionId);
    if (!session) return allFiles;

    const processedFilenames = new Set([
      ...session.processedFiles,
      ...session.failedFiles,
      ...session.skippedFiles
    ]);

    return allFiles.filter(file => !processedFilenames.has(file.originalname));
  }

  /**
   * Generar reporte de sesión
   */
  getSessionReport(sessionId: string): {
    session: UploadSession;
    progress: {
      completed: number;
      total: number;
      percentage: number;
    };
    summary: {
      successful: number;
      failed: number;
      skipped: number;
      duplicates: number;
    };
  } | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    const successful = session.processedFiles.length;
    const failed = session.failedFiles.length;
    const skipped = session.skippedFiles.length;
    const completed = successful + failed + skipped;

    return {
      session,
      progress: {
        completed,
        total: session.totalFiles,
        percentage: Math.round((completed / session.totalFiles) * 100)
      },
      summary: {
        successful,
        failed,
        skipped,
        duplicates: skipped // Los archivos saltados incluyen duplicados
      }
    };
  }

  /**
   * Limpiar sesiones antiguas (más de 1 hora)
   */
  cleanupOldSessions(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.lastActivity < oneHourAgo) {
        this.activeSessions.delete(sessionId);
        console.log(`🧹 Sesión de subida limpiada: ${sessionId}`);
      }
    }
  }
}

export const uploadResumeSystem = new UploadResumeSystem();

// Limpiar sesiones antiguas cada 30 minutos
setInterval(() => {
  uploadResumeSystem.cleanupOldSessions();
}, 30 * 60 * 1000);