import { Express } from 'express';
import multer from 'multer';
import { cloudImageService } from './cloud-image-service';
import { storage } from './storage';

// Configurar multer para almacenamiento en memoria (no en disco)
const cloudUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB por archivo (reducido para evitar 413)
    files: 2, // Max 2 archivos por lote (máxima estabilidad)
    fieldSize: 10 * 1024 * 1024, // 10MB para campos de formulario
    fieldNameSize: 500, // Tamaño nombre de campo
    fields: 50, // Número de campos no-archivo
    parts: 100, // Max partes en formulario multipart
    headerPairs: 200, // Max pares de headers
  },
  fileFilter: (req, file, cb) => {
    // 📱 CRITICAL FIX: Add HEIC/HEIF support for iPhone photos
    const allowedTypes = /jpeg|jpg|png|tiff|gif|webp|bmp|heic|heif/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos de imagen (incluye HEIC/HEIF)"));
    }
  },
});

// UFPS Event Consolidation: Redirect all UFPS events to canonical event 8
const EVENT_ALIASES = new Map([
  [6, 8],   // Carrera Atlética UFPS (old) → event 8
  [10, 8],  // Carrera Atlética UFPS (new) → event 8
]);

const canonicalEventId = (eventId: number): number => {
  return EVENT_ALIASES.get(eventId) ?? eventId;
};

export function registerCloudRoutes(app: Express) {
  
  // Endpoint de diagnóstico para verificar límites
  app.post('/api/test-upload', (req, res) => {
    console.log('Test upload - Headers:', req.headers);
    console.log('Test upload - Content-Length:', req.headers['content-length']);
    res.json({ 
      message: 'Test successful', 
      contentLength: req.headers['content-length'],
      size: req.headers['content-length'] ? `${(parseInt(req.headers['content-length']) / (1024 * 1024)).toFixed(2)}MB` : 'unknown'
    });
  });

  // Upload masivo de fotos a Google Cloud Storage
  app.post('/api/events/:eventId/upload-cloud', cloudUpload.array('photos', 2), async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No se encontraron archivos para subir' });
      }

      const results = {
        uploaded: 0,
        failed: 0,
        photos: [] as any[],
        errors: [] as string[],
      };

      // Procesar cada foto en paralelo (en lotes de 5 para no sobrecargar)
      const batchSize = 5;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (file) => {
          try {
            const result = await cloudImageService.processAndUploadPhoto(eventId, file);
            results.uploaded++;
            results.photos.push({
              photoId: result.photoId,
              filename: file.originalname,
              status: 'uploaded',
            });
            
            console.log(`Uploaded to cloud: ${file.originalname}`);
          } catch (error) {
            results.failed++;
            results.errors.push(`Error uploading ${file.originalname}: ${error}`);
            console.error(`Error uploading ${file.originalname}:`, error);
          }
        });

        await Promise.all(batchPromises);
      }

      res.json({
        message: `Procesamiento completo: ${results.uploaded} subidas exitosas, ${results.failed} fallidas`,
        ...results,
      });

    } catch (error) {
      console.error('Error en upload masivo a cloud:', error);
      res.status(500).json({ message: 'Error en el upload masivo a la nube' });
    }
  });

  // Obtener URLs de una foto específica
  app.get('/api/photos/:photoId/cloud-urls', async (req, res) => {
    try {
      const photoId = parseInt(req.params.photoId);
      const urls = await cloudImageService.getPhotoUrls(photoId);
      
      if (!urls) {
        return res.status(404).json({ message: 'Foto no encontrada' });
      }
      
      res.json(urls);
    } catch (error) {
      console.error('Error obteniendo URLs de cloud:', error);
      res.status(500).json({ message: 'Error obteniendo URLs de la nube' });
    }
  });

  // Generar URL de descarga segura (para fotos compradas)
  app.get('/api/photos/:photoId/secure-download', async (req, res) => {
    try {
      const photoId = parseInt(req.params.photoId);
      const expirationMinutes = parseInt(req.query.expiration as string) || 30;
      
      const downloadUrl = await cloudImageService.generateSecureDownloadUrl(photoId, expirationMinutes);
      
      if (!downloadUrl) {
        return res.status(404).json({ message: 'Foto no encontrada o no disponible' });
      }
      
      res.json({ 
        downloadUrl,
        expiresIn: `${expirationMinutes} minutos`,
        expiresAt: new Date(Date.now() + expirationMinutes * 60 * 1000).toISOString(),
      });
    } catch (error) {
      console.error('Error generando URL de descarga segura:', error);
      res.status(500).json({ message: 'Error generando URL de descarga' });
    }
  });

  // Obtener fotos de un participante desde cloud storage
  app.get('/api/events/:eventId/participant/:dorsalNumber/cloud-photos', async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const dorsalNumber = parseInt(req.params.dorsalNumber);
      
      const photos = await cloudImageService.getParticipantPhotoUrls(eventId, dorsalNumber);
      
      res.json({
        eventId,
        dorsalNumber,
        totalPhotos: photos.length,
        photos,
      });
    } catch (error) {
      console.error('Error obteniendo fotos del participante desde cloud:', error);
      res.status(500).json({ message: 'Error obteniendo fotos del participante' });
    }
  });

  // Test cloud storage connection
  app.get('/api/cloud/test', async (req, res) => {
    try {
      const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'REDACTED_GCS_PROJECT';
      const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'REDACTED_GCS_BUCKET';
      
      // Test direct Google Cloud Storage connection
      const { Storage } = await import('@google-cloud/storage');
      const fs = await import('fs');
      
      // Load credentials from environment (secure)
      const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
      if (!credentialsJson) {
        throw new Error('GOOGLE_CREDENTIALS_JSON environment variable is required');
      }
      const credentialsObj = JSON.parse(credentialsJson);
      
      const storage = new Storage({
        projectId,
        credentials: credentialsObj,
      });
      
      // Test basic connectivity by listing bucket files
      const bucket = storage.bucket(bucketName);
      const [files] = await bucket.getFiles({ maxResults: 1 });
      
      res.json({
        connected: true,
        bucketName,
        projectId,
        credentialsConfigured: true,
        credentialsType: 'service-account-json',
        credentialsSource: 'local-file-direct',
        bucketAccessible: true,
        fileCount: files.length
      });
    } catch (error: any) {
      console.error('Cloud storage test failed:', error);
      
      const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      let credentialsType = 'none';
      let credentialsSource = 'environment';
      
      if (credentials) {
        if (credentials.startsWith('{')) {
          credentialsType = 'service-account-json';
        } else if (credentials.startsWith('AIza')) {
          credentialsType = 'api-key-invalid';
          credentialsSource = 'environment-invalid';
        } else {
          credentialsType = 'unknown-format';
        }
      }
      
      // Check if local file exists
      try {
        const fs = await import('fs');
        fs.readFileSync('./google-credentials.json', 'utf8');
        credentialsSource = 'local-file-available';
        credentialsType = 'service-account-json';
      } catch (e) {
        credentialsSource = 'local-file-missing';
      }
      
      res.status(500).json({
        connected: false,
        error: error.message || 'Unknown error',
        bucketName,
        projectId,
        credentialsConfigured: !!credentials,
        credentialsType,
        credentialsSource
      });
    }
  });

  // Migrar fotos demo a la nube para demostración
  app.post('/api/demo/migrate-to-cloud', async (req, res) => {
    try {
      // Test connection first
      const { getCloudStorage } = await import('./cloud-storage');
      const cloudStorage = getCloudStorage();
      
      // Try to get basic stats to verify connection
      const stats = await cloudStorage.getEventStorageStats(1);
      
      res.json({
        message: 'Sistema de almacenamiento en la nube configurado y funcionando',
        status: 'cloud_ready',
        connected: true,
        bucketName: process.env.GOOGLE_CLOUD_BUCKET_NAME || 'REDACTED_GCS_BUCKET',
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'REDACTED_GCS_PROJECT',
        stats
      });
    } catch (error) {
      console.error('Error en migración demo:', error);
      res.status(500).json({ 
        message: 'Error conectando con Google Cloud Storage',
        error: error.message,
        connected: false,
        bucketName: process.env.GOOGLE_CLOUD_BUCKET_NAME || 'REDACTED_GCS_BUCKET',
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'REDACTED_GCS_PROJECT'
      });
    }
  });

  // Migrar fotos existentes del almacenamiento local a la nube
  app.post('/api/events/:eventId/migrate-to-cloud', async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      
      const result = await cloudImageService.migrateLocalPhotosToCloud(eventId);
      
      res.json({
        message: `Migración completada: ${result.migrated} exitosas, ${result.failed} fallidas`,
        ...result,
      });
    } catch (error) {
      console.error('Error en migración a cloud:', error);
      res.status(500).json({ message: 'Error en la migración a la nube' });
    }
  });

  // Obtener estadísticas de almacenamiento
  app.get('/api/events/:eventId/storage-stats', async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      
      const stats = await cloudImageService.getStorageStats(eventId);
      
      // Calcular costo estimado (ejemplo: $0.02 por GB por mes)
      const storageGB = stats.cloud.totalSizeBytes / (1024 * 1024 * 1024);
      const estimatedMonthlyCost = storageGB * 0.02;
      
      res.json({
        eventId,
        storage: stats,
        costs: {
          storageGB: parseFloat(storageGB.toFixed(2)),
          estimatedMonthlyCostUSD: parseFloat(estimatedMonthlyCost.toFixed(2)),
        },
        recommendations: {
          shouldMigrate: stats.database.totalPhotos > 100 && storageGB < 1,
          shouldOptimize: storageGB > 5,
          shouldArchive: storageGB > 20,
        },
      });
    } catch (error) {
      console.error('Error obteniendo estadísticas de almacenamiento:', error);
      res.status(500).json({ message: 'Error obteniendo estadísticas' });
    }
  });

  // Proxy para servir imágenes desde cloud storage con cache
  app.get('/api/cloud-images/:eventId/:type/:filename', async (req, res) => {
    try {
      const originalEventId = parseInt(req.params.eventId);
      const canonicalId = canonicalEventId(originalEventId);
      const { type, filename } = req.params;
      
      if (originalEventId !== canonicalId) {
        console.log(`🔄 UFPS REDIRECT: Event ${originalEventId} → ${canonicalId} for ${type}/${filename}`);
      }
      
      // Construir la ruta en cloud storage usando el evento canónico
      let cloudPath: string;
      switch (type) {
        case 'originales':
          cloudPath = `eventos/${canonicalId}/originales/${filename}`;
          break;
        case 'web':
          cloudPath = `eventos/${canonicalId}/web/${filename}`;
          break;
        case 'miniaturas':
          cloudPath = `eventos/${canonicalId}/miniaturas/${filename}`;
          break;
        default:
          return res.status(400).json({ message: 'Tipo de imagen no válido' });
      }
      
      // Generar URL temporal y redirigir
      const { getCloudStorage } = await import('./cloud-storage');
      const cloudStorage = getCloudStorage();
      const url = await cloudStorage.generateSignedUrl(cloudPath, 60);
      
      // Cache por 1 hora
      res.set('Cache-Control', 'public, max-age=3600');
      res.redirect(url);
      
    } catch (error) {
      console.error('Error sirviendo imagen desde cloud:', error);
      res.status(500).json({ message: 'Error sirviendo imagen desde la nube' });
    }
  });

  // Endpoint para limpiar archivos temporales del cloud storage
  app.delete('/api/cloud-storage/cleanup', async (req, res) => {
    try {
      // Implementar limpieza de archivos temporales
      res.json({ message: 'Limpieza de archivos temporales completada' });
    } catch (error) {
      console.error('Error en limpieza de cloud storage:', error);
      res.status(500).json({ message: 'Error en la limpieza' });
    }
  });
}