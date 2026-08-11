import { TextractClient, DetectDocumentTextCommand, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';
import fs from 'fs';
import path from 'path';

interface TextractResult {
  dorsalNumbers: number[];
  confidence: number;
  allText: string;
  detectedWords: Array<{
    text: string;
    confidence: number;
    boundingBox?: any;
  }>;
}

export class TextractOCRProcessor {
  private client: TextractClient;

  constructor() {
    // Initialize Textract client - will need AWS credentials
    this.client = new TextractClient({
      region: 'us-east-1' // Default region
    });
  }

  async processImage(imagePath: string): Promise<TextractResult> {
    try {
      console.log(`🔍 Procesando con Amazon Textract: ${imagePath}`);
      
      // Read image file
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }
      
      const imageBytes = fs.readFileSync(imagePath);
      
      // Use DetectDocumentText for better text detection
      const command = new DetectDocumentTextCommand({
        Document: {
          Bytes: imageBytes
        }
      });
      
      const response = await this.client.send(command);
      
      // Process results
      const result = this.processTextractResponse(response);
      
      console.log(`📊 Textract detectó: ${result.dorsalNumbers.length} dorsales`);
      console.log(`📝 Texto completo: "${result.allText}"`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error con Amazon Textract:', error);
      
      // Return fallback result
      return {
        dorsalNumbers: [],
        confidence: 0,
        allText: '',
        detectedWords: []
      };
    }
  }

  private processTextractResponse(response: any): TextractResult {
    const blocks = response.Blocks || [];
    const detectedWords: Array<{ text: string; confidence: number; boundingBox?: any }> = [];
    let allText = '';
    
    // Extract text blocks
    blocks.forEach((block: any) => {
      if (block.BlockType === 'WORD') {
        detectedWords.push({
          text: block.Text,
          confidence: block.Confidence || 0,
          boundingBox: block.Geometry?.BoundingBox
        });
        
        allText += block.Text + ' ';
      } else if (block.BlockType === 'LINE') {
        // Also capture line-level text for better context
        allText += block.Text + '\n';
      }
    });
    
    // Extract dorsal numbers (4-digit numbers)
    const dorsalNumbers = this.extractDorsalNumbers(allText, detectedWords);
    
    // Calculate overall confidence
    const totalConfidence = detectedWords.reduce((sum, word) => sum + word.confidence, 0);
    const avgConfidence = detectedWords.length > 0 ? totalConfidence / detectedWords.length : 0;
    
    return {
      dorsalNumbers,
      confidence: avgConfidence,
      allText: allText.trim(),
      detectedWords
    };
  }

  private extractDorsalNumbers(text: string, words: Array<{ text: string; confidence: number }>): number[] {
    const dorsals = new Set<number>();
    
    // Method 1: Extract 4-digit numbers from complete text
    const fourDigitMatches = text.match(/\b\d{4}\b/g) || [];
    fourDigitMatches.forEach(match => {
      const num = parseInt(match);
      if (num >= 1000 && num <= 9999) {
        dorsals.add(num);
      }
    });
    
    // Method 2: Look for high-confidence 4-digit words
    words.forEach(word => {
      if (word.confidence > 80 && /^\d{4}$/.test(word.text)) {
        const num = parseInt(word.text);
        if (num >= 1000 && num <= 9999) {
          dorsals.add(num);
        }
      }
    });
    
    // Method 3: Try to combine adjacent digits for dorsals
    const digitWords = words.filter(w => /^\d+$/.test(w.text) && w.confidence > 70);
    for (let i = 0; i < digitWords.length - 1; i++) {
      const combined = digitWords[i].text + digitWords[i + 1].text;
      if (combined.length === 4) {
        const num = parseInt(combined);
        if (num >= 1000 && num <= 9999) {
          dorsals.add(num);
        }
      }
    }
    
    return Array.from(dorsals);
  }

  async testWithKnownDorsal(imagePath: string, expectedDorsal: number): Promise<boolean> {
    const result = await this.processImage(imagePath);
    const found = result.dorsalNumbers.includes(expectedDorsal);
    
    console.log(`🎯 Test Textract - Esperado: ${expectedDorsal}, Encontrado: ${found}`);
    console.log(`📋 Dorsales detectados: ${result.dorsalNumbers.join(', ')}`);
    
    return found;
  }
}

export const textractProcessor = new TextractOCRProcessor();

// Función de comparación entre Tesseract y Textract
export async function compareOCRMethods(imagePath: string, expectedDorsal: number): Promise<void> {
  console.log(`\n🔬 COMPARANDO OCR PARA DORSAL ${expectedDorsal}`);
  console.log(`📸 Imagen: ${imagePath}`);
  
  try {
    // Test Textract
    console.log('\n1️⃣ AMAZON TEXTRACT:');
    const textractResult = await textractProcessor.processImage(imagePath);
    const textractFound = textractResult.dorsalNumbers.includes(expectedDorsal);
    
    // Test Tesseract (existing)
    console.log('\n2️⃣ TESSERACT:');
    const { processImageWithRealOCR } = await import('./ocr-real');
    const tesseractResult = await processImageWithRealOCR(imagePath);
    const tesseractFound = tesseractResult.dorsalNumbers.includes(expectedDorsal);
    
    // Comparison
    console.log('\n📊 RESULTADO COMPARATIVO:');
    console.log(`Dorsal esperado: ${expectedDorsal}`);
    console.log(`Textract encontró: ${textractFound ? '✅' : '❌'} (${textractResult.dorsalNumbers.join(', ')})`);
    console.log(`Tesseract encontró: ${tesseractFound ? '✅' : '❌'} (${tesseractResult.dorsalNumbers.join(', ')})`);
    console.log(`Confianza Textract: ${textractResult.confidence.toFixed(1)}%`);
    console.log(`Confianza Tesseract: ${tesseractResult.confidence.toFixed(1)}%`);
    
    if (textractFound && !tesseractFound) {
      console.log('🏆 GANADOR: Amazon Textract es superior para este dorsal');
    } else if (!textractFound && tesseractFound) {
      console.log('🏆 GANADOR: Tesseract es superior para este dorsal');
    } else if (textractFound && tesseractFound) {
      console.log('🤝 EMPATE: Ambos detectaron el dorsal correctamente');
    } else {
      console.log('💔 NINGUNO: Ambos fallaron en detectar el dorsal');
    }
    
  } catch (error) {
    console.error('❌ Error en comparación OCR:', error);
  }
}