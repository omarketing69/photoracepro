import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

/**
 * Optimizaciones de costos para Google Cloud Storage
 * Basado en las recomendaciones de la IA externa
 */

export interface ImageProcessingResult {
  originalPath: string;
  webPath: string;
  thumbnailPath: string;
  originalSize: number;
  webSize: number;
  thumbnailSize: number;
  compressionRatio: number;
}

export class CostOptimizedImageProcessor {
  
  /**
   * Procesa una imagen según las mejores prácticas de costo
   */
  async processImage(inputPath: string, outputDir: string, filename: string): Promise<ImageProcessingResult> {
    const originalStats = fs.statSync(inputPath);
    const originalSize = originalStats.size;
    
    // Rutas de salida
    const originalPath = path.join(outputDir, 'originals', filename);
    const webPath = path.join(outputDir, 'web', `web_${filename}`);
    const thumbnailPath = path.join(outputDir, 'thumbnails', `thumb_${filename}`);
    
    // Crear directorios si no existen
    [
      path.join(outputDir, 'originals'),
      path.join(outputDir, 'web'),
      path.join(outputDir, 'thumbnails')
    ].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    // 1. Copia original (mantener alta resolución)
    // Para impresión y almacenamiento de respaldo
    await sharp(inputPath)
      .jpeg({ quality: 95 }) // Alta calidad para impresión
      .toFile(originalPath);
    
    // 2. Versión web optimizada (1200x1600)
    // Para mostrar en galería web - 200-500KB
    await sharp(inputPath)
      .resize(1200, 1600, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ quality: 80 }) // Calidad media
      .toFile(webPath);
    
    // 3. Miniatura (300x400)
    // Para vistas previas - 20-50KB
    await sharp(inputPath)
      .resize(300, 400, { 
        fit: 'cover' 
      })
      .jpeg({ quality: 75 }) // Calidad optimizada
      .toFile(thumbnailPath);
    
    // Calcular tamaños finales
    const webSize = fs.statSync(webPath).size;
    const thumbnailSize = fs.statSync(thumbnailPath).size;
    const compressionRatio = (originalSize - webSize - thumbnailSize) / originalSize;
    
    return {
      originalPath,
      webPath,
      thumbnailPath,
      originalSize,
      webSize,
      thumbnailSize,
      compressionRatio
    };
  }
  
  /**
   * Estima los costos de almacenamiento para diferentes clases
   */
  estimateStorageCosts(imageSizes: {
    originalSize: number;
    webSize: number;
    thumbnailSize: number;
  }, photosCount: number): {
    standardCost: number;
    nearlineCost: number;
    coldlineCost: number;
    recommendedStrategy: string;
  } {
    const { originalSize, webSize, thumbnailSize } = imageSizes;
    
    // Precios aproximados de Google Cloud Storage (USD por GB por mes)
    const pricing = {
      standard: 0.020,
      nearline: 0.010,
      coldline: 0.004
    };
    
    const totalOriginalGB = (originalSize * photosCount) / (1024 * 1024 * 1024);
    const totalWebGB = (webSize * photosCount) / (1024 * 1024 * 1024);
    const totalThumbnailGB = (thumbnailSize * photosCount) / (1024 * 1024 * 1024);
    
    // Estrategia recomendada:
    // - Originales: Coldline (acceso poco frecuente)
    // - Web: Standard (acceso frecuente)
    // - Miniaturas: Standard (acceso muy frecuente)
    
    const standardCost = (totalOriginalGB + totalWebGB + totalThumbnailGB) * pricing.standard;
    const nearlineCost = (totalOriginalGB + totalWebGB + totalThumbnailGB) * pricing.nearline;
    const coldlineCost = (totalOriginalGB + totalWebGB + totalThumbnailGB) * pricing.coldline;
    
    const recommendedCost = (totalOriginalGB * pricing.coldline) + 
                           (totalWebGB * pricing.standard) + 
                           (totalThumbnailGB * pricing.standard);
    
    return {
      standardCost,
      nearlineCost,
      coldlineCost,
      recommendedStrategy: `Estrategia mixta: $${recommendedCost.toFixed(4)} USD/mes (${(recommendedCost * 4200).toFixed(0)} COP/mes)`
    };
  }
  
  /**
   * Analiza el ahorro de ancho de banda con las optimizaciones
   */
  analyzeBandwidthSavings(originalSize: number, webSize: number, thumbnailSize: number): {
    galleryLoadingSavings: number;
    previewLoadingSavings: number;
    totalSavings: number;
  } {
    // Asumiendo que el 80% del tráfico es para galería (web) y 20% para previews (thumbnails)
    const galleryTrafficRatio = 0.8;
    const previewTrafficRatio = 0.2;
    
    const galleryLoadingSavings = (originalSize - webSize) * galleryTrafficRatio;
    const previewLoadingSavings = (originalSize - thumbnailSize) * previewTrafficRatio;
    const totalSavings = galleryLoadingSavings + previewLoadingSavings;
    
    return {
      galleryLoadingSavings,
      previewLoadingSavings,
      totalSavings
    };
  }
}

export const costOptimizedProcessor = new CostOptimizedImageProcessor();