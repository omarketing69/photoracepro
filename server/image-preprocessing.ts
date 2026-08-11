import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export class ImagePreprocessor {
  private tempDir = path.join(process.cwd(), 'temp');

  constructor() {
    this.ensureTempDir();
  }

  private ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async preprocessForOCR(imagePath: string): Promise<string[]> {
    const preprocessedImages: string[] = [];
    const baseFilename = path.basename(imagePath, path.extname(imagePath));
    
    try {
      // Cargar la imagen original
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      console.log(`Preprocessing image: ${imagePath} (${metadata.width}x${metadata.height})`);
      
      // 1. Versión con contraste mejorado
      const contrastPath = path.join(this.tempDir, `${baseFilename}_contrast.jpg`);
      await image
        .modulate({ brightness: 1.2, saturation: 0.8 })
        .normalize()
        .jpeg({ quality: 90 })
        .toFile(contrastPath);
      preprocessedImages.push(contrastPath);
      
      // 2. Versión en escala de grises con umbralización adaptativa
      const thresholdPath = path.join(this.tempDir, `${baseFilename}_threshold.jpg`);
      await image
        .grayscale()
        .normalise()
        .modulate({ brightness: 1.3 })
        .linear(1.5, 0) // Aplicar contraste con linear
        .threshold(140)
        .jpeg({ quality: 95 })
        .toFile(thresholdPath);
      preprocessedImages.push(thresholdPath);
      
      // 3. Versión con enfoque mejorado
      const sharpenPath = path.join(this.tempDir, `${baseFilename}_sharpen.jpg`);
      await image
        .sharpen(3.0)
        .modulate({ brightness: 1.1 })
        .jpeg({ quality: 90 })
        .toFile(sharpenPath);
      preprocessedImages.push(sharpenPath);
      
      // 4. Versión redimensionada para mejor OCR
      const resizedPath = path.join(this.tempDir, `${baseFilename}_resized.jpg`);
      await image
        .resize(Math.min(metadata.width || 1200, 1600), Math.min(metadata.height || 800, 1200), {
          fit: 'inside',
          withoutEnlargement: true
        })
        .sharpen()
        .jpeg({ quality: 85 })
        .toFile(resizedPath);
      preprocessedImages.push(resizedPath);
      
      console.log(`Created ${preprocessedImages.length} preprocessed versions`);
      return preprocessedImages;
      
    } catch (error) {
      console.error('Error preprocessing image:', error);
      return [];
    }
  }

  async cleanupTempFiles(filePaths: string[]) {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error('Error cleaning up temp file:', filePath, error);
      }
    }
  }

  async extractTextRegions(imagePath: string): Promise<string[]> {
    // Crear múltiples versiones optimizadas para diferentes condiciones
    const textRegions: string[] = [];
    const baseFilename = path.basename(imagePath, path.extname(imagePath));
    
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        return [];
      }
      
      // Dividir la imagen en regiones donde típicamente aparecen dorsales
      const regions = [
        // Región central (pecho)
        {
          left: Math.floor(metadata.width * 0.3),
          top: Math.floor(metadata.height * 0.3),
          width: Math.floor(metadata.width * 0.4),
          height: Math.floor(metadata.height * 0.4),
          name: 'chest'
        },
        // Región superior (número en la frente o gorra)
        {
          left: Math.floor(metadata.width * 0.25),
          top: Math.floor(metadata.height * 0.1),
          width: Math.floor(metadata.width * 0.5),
          height: Math.floor(metadata.height * 0.3),
          name: 'head'
        },
        // Región inferior (número en piernas o shorts)
        {
          left: Math.floor(metadata.width * 0.2),
          top: Math.floor(metadata.height * 0.6),
          width: Math.floor(metadata.width * 0.6),
          height: Math.floor(metadata.height * 0.3),
          name: 'legs'
        }
      ];
      
      for (const region of regions) {
        const regionPath = path.join(this.tempDir, `${baseFilename}_region_${region.name}.jpg`);
        
        try {
          await image
            .extract(region)
            .resize(400, 300, { fit: 'inside' })
            .sharpen()
            .grayscale()
            .normalize()
            .jpeg({ quality: 90 })
            .toFile(regionPath);
            
          textRegions.push(regionPath);
        } catch (error) {
          console.error(`Error extracting region ${region.name}:`, error);
          // Continuar con las otras regiones
        }
      }
      
      console.log(`Extracted ${textRegions.length} text regions`);
      return textRegions;
      
    } catch (error) {
      console.error('Error extracting text regions:', error);
      return [];
    }
  }
}

export const imagePreprocessor = new ImagePreprocessor();