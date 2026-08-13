import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { storage } from './storage';
import { GoogleVisionOCRProcessor } from './google-vision-ocr';
import { getCloudStorage } from './cloud-storage';

// Configuración de multer para guardar archivos localmente
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const eventId = req.params.id;
    const uploadDir = path.join(process.cwd(), 'uploads', eventId);
    
    // Crear directorio si no existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${sanitizedName}`);
  }
});

export const localUpload = multer({ 
  storage: localStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // 📱 CRITICAL FIX: Add HEIC/HEIF support for iPhone photos
    const allowedTypes = /jpeg|jpg|png|gif|bmp|tiff|heic|heif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen (incluye HEIC/HEIF)'));
    }
  }
});

export async function processSimpleUpload(eventId: number, files: Express.Multer.File[]) {
  console.log(`🔄 Procesando ${files.length} fotos para evento ${eventId}`);
  
  const googleVisionProcessor = new GoogleVisionOCRProcessor(getCloudStorage());
  const results = [];
  
  for (const file of files) {
    try {
      console.log(`🔍 Procesando: ${file.originalname}`);
      
      // 1. Generar miniatura
      const thumbnailDir = path.join(process.cwd(), 'uploads', 'thumbnails');
      if (!fs.existsSync(thumbnailDir)) {
        fs.mkdirSync(thumbnailDir, { recursive: true });
      }
      
      // 1. Generar miniatura optimizada (300x400 como recomendado)
      const thumbnailPath = path.join(thumbnailDir, `thumb_${file.filename}`);
      await sharp(file.path)
        .resize(300, 400, { fit: 'cover' })
        .jpeg({ quality: 75 }) // Reducir calidad para optimizar tamaño (20-50KB)
        .toFile(thumbnailPath);
      
      // 2. Generar versión web optimizada (1200x1600)
      const webDir = path.join(process.cwd(), 'uploads', 'web');
      if (!fs.existsSync(webDir)) {
        fs.mkdirSync(webDir, { recursive: true });
      }
      
      const webPath = path.join(webDir, `web_${file.filename}`);
      await sharp(file.path)
        .resize(1200, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 }) // Calidad media para 200-500KB
        .toFile(webPath);
      
      // 2. Procesar con Google Vision OCR
      const ocrResult = await googleVisionProcessor.processImage(file.path);

      // 2b. Detección facial real. Antes este flujo guardaba `faces: []` y la
      // búsqueda por selfie nunca encontraba caras en estas fotos.
      let detectedFaces: Awaited<ReturnType<GoogleVisionOCRProcessor['detectFacesFromBuffer']>> = [];
      try {
        if (fs.existsSync(file.path)) {
          const buffer = fs.readFileSync(file.path);
          detectedFaces = await googleVisionProcessor.detectFacesFromBuffer(buffer);
          console.log(`👤 [FACE] ${file.originalname}: ${detectedFaces.length} face(s) detectadas (simple-upload)`);
        }
      } catch (faceErr) {
        console.warn(`⚠️ [FACE] No se pudieron detectar caras para ${file.originalname}:`, faceErr);
      }

      // 3. Guardar en base de datos con todas las versiones
      const photo = await storage.createPhoto({
        eventId,
        filename: file.originalname,
        originalPath: file.path, // Original alta resolución
        webPath: webPath, // Versión web optimizada
        thumbnailPath: thumbnailPath, // Miniatura
        detectedDorsals: ocrResult.dorsalNumbers,
        faces: detectedFaces,
        processed: true,
        processingStatus: 'completed'
      });
      
      console.log(`✅ ${file.originalname}: ${ocrResult.dorsalNumbers.length} dorsales detectados [${ocrResult.dorsalNumbers.join(', ')}]`);
      
      results.push({
        photo,
        dorsalsDetected: ocrResult.dorsalNumbers.length,
        dorsals: ocrResult.dorsalNumbers
      });
      
    } catch (error) {
      console.error(`❌ Error procesando ${file.originalname}:`, error);
      
      // Guardar foto sin dorsales como fallback
      try {
        const photo = await storage.createPhoto({
          eventId,
          filename: file.originalname,
          originalPath: file.path,
          webPath: file.path,
          thumbnailPath: null,
          detectedDorsals: [],
          faces: [],
          processed: false,
          processingStatus: 'failed'
        });
        
        results.push({
          photo,
          dorsalsDetected: 0,
          dorsals: [],
          error: error.message
        });
      } catch (dbError) {
        console.error(`❌ Error guardando foto fallida:`, dbError);
      }
    }
  }
  
  return results;
}