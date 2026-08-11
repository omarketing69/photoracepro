import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

interface CloudStorageConfig {
  bucketName: string;
  projectId: string;
  keyFilename?: string;
}

export class CloudPhotoStorage {
  private storage: Storage;
  private bucketName: string;

  constructor(config: CloudStorageConfig) {
    console.log(`🔍 [GCS] Inicializando Google Cloud Storage...`);
    console.log(`🔍 [GCS] Project ID: ${config.projectId}`);
    console.log(`🔍 [GCS] Bucket Name: ${config.bucketName}`);
    
    // SECURE: Use environment-based credentials only
    try {
      const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
      
      if (!credentialsJson) {
        throw new Error('GOOGLE_CREDENTIALS_JSON environment variable is required');
      }
      
      let credentialsObj;
      try {
        credentialsObj = JSON.parse(credentialsJson);
      } catch (parseError) {
        throw new Error('GOOGLE_CREDENTIALS_JSON contains invalid JSON');
      }
      
      this.storage = new Storage({
        projectId: config.projectId,
        credentials: credentialsObj,
      });
      
      console.log('✅ [SECURE] Using environment-based credentials for GCS');
      
    } catch (error) {
      console.error('❌ [GCS] Failed to initialize with environment credentials:', error);
      throw new Error(`Could not initialize Google Cloud Storage: ${error.message}`);
    }
    
    this.bucketName = config.bucketName;
    console.log(`✅ [GCS] Configuración completada - Bucket: ${this.bucketName}`);
  }

  /**
   * Subir foto original al bucket organizadao por evento
   */
  async uploadOriginalPhoto(eventId: number, photoFile: Express.Multer.File): Promise<string> {
    console.log(`🔍 [GCS] Iniciando subida de ${photoFile.originalname} a Google Cloud Storage`);
    
    const fileName = `eventos/${eventId}/originales/${Date.now()}-${photoFile.originalname}`;
    console.log(`🔍 [GCS] Nombre del archivo: ${fileName}`);
    console.log(`🔍 [GCS] Bucket: ${this.bucketName}`);
    console.log(`🔍 [GCS] Tamaño del archivo: ${photoFile.buffer.length} bytes`);
    
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      await file.save(photoFile.buffer, {
        metadata: {
          contentType: photoFile.mimetype,
          metadata: {
            eventId: eventId.toString(),
            originalName: photoFile.originalname,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      console.log(`✅ [GCS] Foto original subida exitosamente: ${fileName}`);
      return fileName;
    } catch (error) {
      console.error(`❌ [GCS] Error subiendo foto original ${photoFile.originalname}:`, error);
      throw error;
    }
  }

  /**
   * Generar y subir versión web optimizada
   */
  async uploadWebVersion(eventId: number, originalFileName: string, webBuffer: Buffer): Promise<string> {
    console.log(`🔍 [GCS] Subiendo versión web optimizada para: ${originalFileName}`);
    
    // Extract just the filename to avoid nested paths
    const basename = path.basename(originalFileName);
    const fileName = `eventos/${eventId}/web/${basename}`;
    console.log(`🔍 [GCS] Nombre versión web: ${fileName}`);
    console.log(`🔍 [GCS] Tamaño versión web: ${webBuffer.length} bytes`);
    
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      await file.save(webBuffer, {
        metadata: {
          contentType: 'image/jpeg',
          metadata: {
            eventId: eventId.toString(),
            version: 'web',
            optimized: 'true',
          },
        },
      });

      console.log(`✅ [GCS] Versión web subida exitosamente: ${fileName}`);
      return fileName;
    } catch (error) {
      console.error(`❌ [GCS] Error subiendo versión web para ${originalFileName}:`, error);
      throw error;
    }
  }

  /**
   * Generar y subir miniatura
   */
  async uploadThumbnail(eventId: number, originalFileName: string, thumbnailBuffer: Buffer): Promise<string> {
    console.log(`🔍 [GCS] Subiendo miniatura para: ${originalFileName}`);
    
    // Extract just the filename to avoid nested paths
    const basename = path.basename(originalFileName);
    const fileName = `eventos/${eventId}/miniaturas/${basename}`;
    console.log(`🔍 [GCS] Nombre miniatura: ${fileName}`);
    console.log(`🔍 [GCS] Tamaño miniatura: ${thumbnailBuffer.length} bytes`);
    
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      await file.save(thumbnailBuffer, {
        metadata: {
          contentType: 'image/jpeg',
          metadata: {
            eventId: eventId.toString(),
            version: 'thumbnail',
            size: '200x200',
          },
        },
      });

      console.log(`✅ [GCS] Miniatura subida exitosamente: ${fileName}`);
      return fileName;
    } catch (error) {
      console.error(`❌ [GCS] Error subiendo miniatura para ${originalFileName}:`, error);
      throw error;
    }
  }

  /**
   * Generar URL firmada SEGURA para descarga temporal comercial
   * TTL MÁXIMO: 10 minutos para seguridad comercial
   */
  async generateSignedUrl(fileName: string, expirationMinutes: number = 10, options: any = {}): Promise<string> {
    // SEGURIDAD COMERCIAL: Máximo 10 minutos de TTL
    const maxTTL = 10;
    const safeTTL = Math.min(expirationMinutes, maxTTL);
    
    if (expirationMinutes > maxTTL) {
      console.warn(`⚠️ [SECURITY] TTL reducido de ${expirationMinutes} a ${maxTTL} minutos por seguridad comercial`);
    }

    console.log(`🔐 [GCS] Generando URL firmada segura: ${fileName} (TTL: ${safeTTL} min)`);
    
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(fileName);

    // Verificar que el archivo existe antes de generar URL
    try {
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`File not found: ${fileName}`);
      }
    } catch (error) {
      console.error(`❌ [GCS] Error checking file existence: ${fileName}`, error);
      throw new Error(`Cannot generate signed URL for non-existent file: ${fileName}`);
    }

    const signedUrlOptions: any = {
      action: 'read',
      expires: Date.now() + (safeTTL * 60 * 1000),
      version: 'v4', // Usar versión más segura
    };

    // Add secure response headers if provided
    if (options.responseContentDisposition) {
      signedUrlOptions.responseContentDisposition = options.responseContentDisposition;
    }
    if (options.responseContentType) {
      signedUrlOptions.responseContentType = options.responseContentType;
    }

    // Generar URL firmada segura
    const [url] = await file.getSignedUrl(signedUrlOptions);

    // Log para auditoría de seguridad
    console.log(`✅ [GCS] URL firmada generada - Archivo: ${fileName}, TTL: ${safeTTL}min, Expira: ${new Date(Date.now() + (safeTTL * 60 * 1000)).toISOString()}`);

    return url;
  }

  /**
   * Generar URL pública para miniaturas (con watermark)
   */
  async generatePublicUrl(fileName: string): Promise<string> {
    return `https://storage.googleapis.com/${this.bucketName}/${fileName}`;
  }

  /**
   * Organizar fotos por participante (copia referencias)
   */
  async organizeByParticipant(eventId: number, photoFileName: string, dorsalNumbers: number[]): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    
    for (const dorsal of dorsalNumbers) {
      const participantPath = `eventos/${eventId}/participantes/dorsal_${dorsal}/`;
      const metadataFile = bucket.file(`${participantPath}fotos.json`);
      
      try {
        // Leer lista actual de fotos del participante
        const [exists] = await metadataFile.exists();
        let photoList: string[] = [];
        
        if (exists) {
          const [content] = await metadataFile.download();
          photoList = JSON.parse(content.toString());
        }
        
        // Agregar nueva foto si no existe
        if (!photoList.includes(photoFileName)) {
          photoList.push(photoFileName);
          
          // Guardar lista actualizada
          await metadataFile.save(JSON.stringify(photoList, null, 2), {
            metadata: {
              contentType: 'application/json',
              metadata: {
                eventId: eventId.toString(),
                dorsalNumber: dorsal.toString(),
                photoCount: photoList.length.toString(),
                lastUpdated: new Date().toISOString(),
              },
            },
          });
        }
      } catch (error) {
        console.error(`Error organizing photo for dorsal ${dorsal}:`, error);
      }
    }
  }

  /**
   * Obtener fotos de un participante
   */
  async getParticipantPhotos(eventId: number, dorsalNumber: number): Promise<string[]> {
    const bucket = this.storage.bucket(this.bucketName);
    const metadataFile = bucket.file(`eventos/${eventId}/participantes/dorsal_${dorsalNumber}/fotos.json`);
    
    try {
      const [exists] = await metadataFile.exists();
      if (!exists) return [];
      
      const [content] = await metadataFile.download();
      return JSON.parse(content.toString());
    } catch (error) {
      console.error(`Error getting photos for dorsal ${dorsalNumber}:`, error);
      return [];
    }
  }

  /**
   * Eliminar fotos de un evento (para pruebas)
   */
  async deleteEventPhotos(eventId: number): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    const [files] = await bucket.getFiles({
      prefix: `eventos/${eventId}/`,
    });

    const deletePromises = files.map(file => file.delete());
    await Promise.all(deletePromises);
    
    console.log(`Deleted ${files.length} files for event ${eventId}`);
  }

  /**
   * Obtener estadísticas de almacenamiento de un evento
   */
  async getEventStorageStats(eventId: number): Promise<{
    originalPhotos: number;
    webVersions: number;
    thumbnails: number;
    totalSizeBytes: number;
    participants: number;
  }> {
    const bucket = this.storage.bucket(this.bucketName);
    
    const [originalFiles] = await bucket.getFiles({ prefix: `eventos/${eventId}/originales/` });
    const [webFiles] = await bucket.getFiles({ prefix: `eventos/${eventId}/web/` });
    const [thumbnailFiles] = await bucket.getFiles({ prefix: `eventos/${eventId}/miniaturas/` });
    const [participantFiles] = await bucket.getFiles({ prefix: `eventos/${eventId}/participantes/` });
    
    const totalSize = [...originalFiles, ...webFiles, ...thumbnailFiles]
      .reduce((sum, file) => sum + (file.metadata.size ? parseInt(String(file.metadata.size)) : 0), 0);
    
    return {
      originalPhotos: originalFiles.length,
      webVersions: webFiles.length,
      thumbnails: thumbnailFiles.length,
      totalSizeBytes: totalSize,
      participants: participantFiles.length,
    };
  }

  /**
   * Listar todos los archivos de un evento para debugging
   */
  async listEventFiles(eventId: number, subfolder?: string): Promise<string[]> {
    const bucket = this.storage.bucket(this.bucketName);
    const prefix = subfolder ? `eventos/${eventId}/${subfolder}/` : `eventos/${eventId}/`;
    const [files] = await bucket.getFiles({ prefix });
    
    return files.map(file => file.name.replace(prefix, ''));
  }

  /**
   * Listar todas las carpetas de eventos en Google Cloud Storage
   */
  async listAllEventFolders(): Promise<number[]> {
    const bucket = this.storage.bucket(this.bucketName);
    
    try {
      // Method 1: Get all files with prefix to find event folders
      const [files] = await bucket.getFiles({ prefix: 'eventos/' });
      const eventIds = new Set<number>();
      
      // Extract event IDs from file paths
      files.forEach(file => {
        const match = file.name.match(/^eventos\/(\d+)\//);
        if (match) {
          eventIds.add(parseInt(match[1]));
        }
      });
      
      console.log(`🔍 [GCS] Found event folders via file listing: ${Array.from(eventIds).sort((a, b) => a - b).join(', ')}`);
      return Array.from(eventIds).sort((a, b) => a - b);
      
    } catch (error) {
      console.error('❌ [GCS] Error listing event folders:', error);
      throw error;
    }
  }

  /**
   * Leer contenido de un archivo desde Google Cloud Storage
   */
  async downloadFile(fileName: string): Promise<Buffer> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);
      
      const [contents] = await file.download();
      return contents;
    } catch (error) {
      console.error(`❌ [GCS] Error downloading file ${fileName}:`, error);
      throw error;
    }
  }
}

// Configuración singleton
let cloudStorage: CloudPhotoStorage | null = null;

export function getCloudStorage(): CloudPhotoStorage {
  // Create instance with environment-based configuration
  return new CloudPhotoStorage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'REDACTED_GCS_PROJECT',
    bucketName: process.env.GOOGLE_CLOUD_BUCKET_NAME || 'REDACTED_GCS_BUCKET',
    // Credentials loaded from GOOGLE_CREDENTIALS_JSON environment variable
  });
}

/**
 * Crear estructura completa de directorios para un nuevo evento en Google Cloud Storage
 */
export async function createEventStructureInCloud(eventId: number): Promise<void> {
  console.log(`🔧 Creating Google Cloud Storage structure for event ${eventId}`);
  
  const cloudStorage = getCloudStorage();
  
  try {
    // Crear estructura de directorios básica para el evento
    const directories = [
      `eventos/${eventId}/`,
      `eventos/${eventId}/originales/`,
      `eventos/${eventId}/web/`,
      `eventos/${eventId}/miniaturas/`,
      `eventos/${eventId}/participantes/`
    ];
    
    for (const dir of directories) {
      try {
        // Crear un archivo temporal para generar la estructura de directorios
        const tempFileName = `${dir}.gitkeep`;
        // Crear un archivo temporal para generar la estructura de directorios
        const bucket = cloudStorage.storage.bucket(cloudStorage.bucketName);
        const file = bucket.file(tempFileName);
        await file.save(Buffer.from('# Directory structure file'), {
          metadata: { contentType: 'text/plain' }
        });
        console.log(`✅ Created directory: ${dir}`);
      } catch (error) {
        console.log(`⚠️ Directory ${dir} might already exist or error: ${error}`);
      }
    }
    
    console.log(`🎉 Google Cloud Storage structure created successfully for event ${eventId}`);
    
  } catch (error) {
    console.error(`❌ Error creating Google Cloud Storage structure for event ${eventId}:`, error);
    throw error;
  }
}

/**
 * Estructura organizacional en Google Cloud Storage:
 * 
 * racephoto-fotos/
 * ├── eventos/
 * │   ├── evento_001/
 * │   │   ├── originales/          # Fotos originales en alta resolución
 * │   │   ├── web/                 # Versiones optimizadas para web
 * │   │   ├── miniaturas/          # Miniaturas 200x200
 * │   │   └── participantes/       # Organización por dorsal
 * │   │       ├── dorsal_1234/
 * │   │       │   └── fotos.json   # Lista de fotos del participante
 * │   │       └── dorsal_5678/
 * │   │           └── fotos.json
 * │   └── evento_002/
 * │       └── ...
 * └── temp/                        # Archivos temporales (se eliminan cada 24h)
 */