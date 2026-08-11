import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export class AdvancedImagePreprocessor {
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
    try {
      console.log(`Advanced preprocessing: ${imagePath}`);
      
      // Generar múltiples versiones preprocesadas
      const processedImages = await Promise.all([
        this.createGrayscaleEnhanced(imagePath),
        this.createHighContrastVersion(imagePath),
        this.createBinarizedVersion(imagePath),
        this.createMorphologicalCleaned(imagePath),
        this.createSharpened(imagePath)
      ]);

      console.log(`Generated ${processedImages.length} preprocessed versions`);
      return processedImages.filter(img => img !== null) as string[];

    } catch (error) {
      console.error('Error in advanced preprocessing:', error);
      return [imagePath]; // Devolver imagen original como fallback
    }
  }

  private async createGrayscaleEnhanced(imagePath: string): Promise<string | null> {
    try {
      const outputPath = path.join(this.tempDir, `grayscale_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`);
      
      await sharp(imagePath)
        .grayscale()
        .normalize() // Mejora automática de contraste
        .jpeg({ quality: 95 })
        .toFile(outputPath);
        
      return outputPath;
    } catch (error) {
      console.error('Error creating grayscale version:', error);
      return null;
    }
  }

  private async createHighContrastVersion(imagePath: string): Promise<string | null> {
    try {
      const outputPath = path.join(this.tempDir, `contrast_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`);
      
      await sharp(imagePath)
        .grayscale()
        .linear(1.5, -30) // Aumentar contraste y reducir brillo
        .gamma(1.2) // Ajustar gamma para mejorar visibilidad
        .jpeg({ quality: 95 })
        .toFile(outputPath);
        
      return outputPath;
    } catch (error) {
      console.error('Error creating high contrast version:', error);
      return null;
    }
  }

  private async createBinarizedVersion(imagePath: string): Promise<string | null> {
    try {
      const outputPath = path.join(this.tempDir, `binary_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`);
      
      await sharp(imagePath)
        .grayscale()
        .normalize()
        .threshold(128) // Binarización simple
        .jpeg({ quality: 95 })
        .toFile(outputPath);
        
      return outputPath;
    } catch (error) {
      console.error('Error creating binary version:', error);
      return null;
    }
  }

  private async createMorphologicalCleaned(imagePath: string): Promise<string | null> {
    try {
      const outputPath = path.join(this.tempDir, `cleaned_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`);
      
      await sharp(imagePath)
        .grayscale()
        .blur(0.5) // Filtro gaussiano ligero para reducir ruido
        .sharpen() // Enfoque para texto
        .linear(1.2, -20) // Mejorar contraste
        .jpeg({ quality: 95 })
        .toFile(outputPath);
        
      return outputPath;
    } catch (error) {
      console.error('Error creating cleaned version:', error);
      return null;
    }
  }

  private async createSharpened(imagePath: string): Promise<string | null> {
    try {
      const outputPath = path.join(this.tempDir, `sharp_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`);
      
      await sharp(imagePath)
        .grayscale()
        .sharpen() // Enfoque agresivo
        .modulate({ brightness: 1.1, saturation: 0 }) // Aumentar brillo ligeramente
        .jpeg({ quality: 95 })
        .toFile(outputPath);
        
      return outputPath;
    } catch (error) {
      console.error('Error creating sharpened version:', error);
      return null;
    }
  }

  async cleanupTempFiles(filePaths: string[]) {
    for (const filePath of filePaths) {
      try {
        if (filePath.includes(this.tempDir) && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error(`Error deleting temp file ${filePath}:`, error);
      }
    }
  }
}

export const advancedImagePreprocessor = new AdvancedImagePreprocessor();