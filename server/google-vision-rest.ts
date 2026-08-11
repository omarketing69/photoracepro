import fs from 'fs';
import fetch from 'node-fetch';

interface GoogleVisionResult {
  dorsalNumbers: number[];
  confidence: number;
  allText: string;
  detectedWords: Array<{
    text: string;
    confidence: number;
    boundingBox?: any;
  }>;
}

export class GoogleVisionRESTProcessor {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_VISION_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('GOOGLE_VISION_API_KEY is required');
    }
    console.log('✅ Google Vision REST client initialized with API Key');
  }

  async processImage(imagePath: string): Promise<GoogleVisionResult> {
    try {
      console.log(`🔍 Procesando con Google Vision REST API: ${imagePath}`);
      
      // Verify image exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }
      
      // Read and encode image
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      // Make API request
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                image: {
                  content: base64Image,
                },
                features: [
                  {
                    type: 'TEXT_DETECTION',
                    maxResults: 50,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Vision API error: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      // Process results
      const processedResult = this.processGoogleVisionResponse(result);
      
      console.log(`📊 Google Vision detectó: ${processedResult.dorsalNumbers.length} dorsales`);
      console.log(`📝 Dorsales encontrados: [${processedResult.dorsalNumbers.join(', ')}]`);
      console.log(`📄 Texto completo: "${processedResult.allText.substring(0, 100)}..."`);
      
      return processedResult;
      
    } catch (error) {
      console.error('❌ Error con Google Vision REST API:', error);
      
      // Return fallback result
      return {
        dorsalNumbers: [],
        confidence: 0,
        allText: '',
        detectedWords: []
      };
    }
  }

  private processGoogleVisionResponse(result: any): GoogleVisionResult {
    const responses = result.responses || [];
    if (responses.length === 0) {
      return {
        dorsalNumbers: [],
        confidence: 0,
        allText: '',
        detectedWords: []
      };
    }

    const textAnnotations = responses[0].textAnnotations || [];
    const detectedWords: Array<{ text: string; confidence: number; boundingBox?: any }> = [];
    let allText = '';
    
    // First annotation contains all detected text
    if (textAnnotations.length > 0) {
      allText = textAnnotations[0].description || '';
    }
    
    // Process individual words/symbols
    for (let i = 1; i < textAnnotations.length; i++) {
      const annotation = textAnnotations[i];
      detectedWords.push({
        text: annotation.description || '',
        confidence: 0.8, // REST API doesn't provide confidence scores
        boundingBox: annotation.boundingPoly
      });
    }
    
    // Extract dorsal numbers
    const dorsalNumbers = this.extractDorsalNumbers(allText, detectedWords);
    
    return {
      dorsalNumbers,
      confidence: dorsalNumbers.length > 0 ? 0.8 : 0,
      allText,
      detectedWords
    };
  }

  private extractDorsalNumbers(fullText: string, words: Array<{ text: string; confidence: number }>): number[] {
    const dorsalNumbers: number[] = [];
    const processedNumbers = new Set<number>();
    
    // Method 1: Find 4-digit numbers directly in full text
    const fourDigitMatches = fullText.match(/\b\d{4}\b/g) || [];
    fourDigitMatches.forEach(match => {
      const number = parseInt(match, 10);
      if (number >= 1000 && number <= 9999) {
        if (!processedNumbers.has(number)) {
          dorsalNumbers.push(number);
          processedNumbers.add(number);
        }
      }
    });
    
    // Method 2: Find 3-digit numbers (common in smaller races)
    const threeDigitMatches = fullText.match(/\b\d{3}\b/g) || [];
    threeDigitMatches.forEach(match => {
      const number = parseInt(match, 10);
      if (number >= 100 && number <= 999) {
        if (!processedNumbers.has(number)) {
          dorsalNumbers.push(number);
          processedNumbers.add(number);
        }
      }
    });
    
    // Method 3: Process individual words to find isolated digits
    const digits: string[] = [];
    words.forEach(word => {
      if (/^\d+$/.test(word.text)) {
        digits.push(word.text);
      }
    });
    
    // Try to form 4-digit numbers from consecutive digits
    for (let i = 0; i < digits.length - 1; i++) {
      const combined = digits[i] + digits[i + 1];
      if (combined.length === 4) {
        const number = parseInt(combined, 10);
        if (number >= 1000 && number <= 9999) {
          if (!processedNumbers.has(number)) {
            dorsalNumbers.push(number);
            processedNumbers.add(number);
          }
        }
      }
    }
    
    return dorsalNumbers.sort((a, b) => a - b);
  }
}

// Export singleton instance
export const googleVisionProcessor = new GoogleVisionRESTProcessor();