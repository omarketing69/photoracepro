#!/usr/bin/env tsx

/**
 * EMERGENCY FIX: Extract dorsals from filenames for Event 5
 * 
 * Event 5 "Carrera de la Rama Judicial" has 502 photos but 0 detected dorsals
 * OCR processing failed, but dorsals are clearly visible in filenames
 * Pattern: 1757250647804-1000190551.jpg → dorsal 190551
 */

import { db } from './server/db';
import { photos } from './shared/schema';
import { eq } from 'drizzle-orm';

async function emergencyFixEvent5Dorsals() {
  console.log('🚨 EMERGENCY FIX: Starting dorsal extraction for Event 5...');
  
  try {
    // Get all photos for Event 5
    const event5Photos = await db
      .select()
      .from(photos)
      .where(eq(photos.eventId, 5));
    
    console.log(`📊 Found ${event5Photos.length} photos for Event 5`);
    
    let successCount = 0;
    let errorCount = 0;
    const extractedDorsals = new Set<number>();
    
    for (const photo of event5Photos) {
      try {
        const dorsals = extractDorsalsFromFilename(photo.filename);
        
        if (dorsals.length > 0) {
          // Update the photo with extracted dorsals
          await db
            .update(photos)
            .set({ 
              detectedDorsals: dorsals,
              processedAt: new Date()
            })
            .where(eq(photos.id, photo.id));
          
          dorsals.forEach(d => extractedDorsals.add(d));
          successCount++;
          
          console.log(`✅ ${photo.filename} → dorsals: ${dorsals.join(', ')}`);
        } else {
          errorCount++;
          console.log(`❌ ${photo.filename} → no dorsals extracted`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing ${photo.filename}:`, error);
      }
    }
    
    console.log('\n📈 EMERGENCY FIX RESULTS:');
    console.log(`✅ Successfully processed: ${successCount} photos`);
    console.log(`❌ Failed to process: ${errorCount} photos`);
    console.log(`🎯 Total unique dorsals extracted: ${extractedDorsals.size}`);
    console.log(`🏃‍♂️ Dorsals range: ${Math.min(...extractedDorsals)} - ${Math.max(...extractedDorsals)}`);
    
    // Show a sample of extracted dorsals
    const sortedDorsals = Array.from(extractedDorsals).sort((a, b) => a - b);
    console.log(`📋 Sample dorsals: ${sortedDorsals.slice(0, 20).join(', ')}${sortedDorsals.length > 20 ? '...' : ''}`);
    
    return {
      success: true,
      totalPhotos: event5Photos.length,
      successCount,
      errorCount,
      extractedDorsalsCount: extractedDorsals.size
    };
    
  } catch (error) {
    console.error('🚨 EMERGENCY FIX FAILED:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function extractDorsalsFromFilename(filename: string): number[] {
  // Pattern: 1757250647804-1000190551.jpg → extract 190551
  // Or: 1757250647804-1000190551.jpg → extract 190551
  
  const dorsals: number[] = [];
  
  try {
    // Method 1: Extract from pattern timestamp-1000{dorsal}.jpg
    const match1 = filename.match(/\d+-1000(\d+)\.jpg$/);
    if (match1) {
      const dorsal = parseInt(match1[1]);
      if (dorsal && dorsal > 0 && dorsal < 1000000) {
        dorsals.push(dorsal);
      }
    }
    
    // Method 2: Extract any 3-6 digit number at the end before extension
    if (dorsals.length === 0) {
      const match2 = filename.match(/(\d{3,6})\.jpg$/);
      if (match2) {
        const dorsal = parseInt(match2[1]);
        if (dorsal && dorsal > 0 && dorsal < 1000000) {
          dorsals.push(dorsal);
        }
      }
    }
    
    // Method 3: Extract from pattern with dash separator
    if (dorsals.length === 0) {
      const match3 = filename.match(/-(\d{3,6})\.jpg$/);
      if (match3) {
        const dorsal = parseInt(match3[1]);
        if (dorsal && dorsal > 0 && dorsal < 1000000) {
          dorsals.push(dorsal);
        }
      }
    }
    
  } catch (error) {
    console.error(`Error extracting dorsal from ${filename}:`, error);
  }
  
  return dorsals;
}

// Test the extraction function
function testExtraction() {
  const testFiles = [
    '1757250647804-1000190551.jpg',
    '1757250647810-1000190550.jpg', 
    '1757250652975-1000190549.jpg',
    '1757250652976-1000190548.jpg',
    '1757250658565-1000190547.jpg'
  ];
  
  console.log('\n🧪 Testing extraction function:');
  testFiles.forEach(filename => {
    const dorsals = extractDorsalsFromFilename(filename);
    console.log(`${filename} → ${dorsals.join(', ')}`);
  });
}

// Run the emergency fix
async function main() {
  console.log('🚨 STARTING EMERGENCY FIX FOR EVENT 5');
  console.log('=' .repeat(50));
  
  // Test extraction first
  testExtraction();
  
  // Run the fix
  const result = await emergencyFixEvent5Dorsals();
  
  console.log('\n' + '='.repeat(50));
  console.log('🚨 EMERGENCY FIX COMPLETED');
  console.log('Result:', result);
  
  process.exit(result.success ? 0 : 1);
}

// Auto-run when executed directly
main().catch(console.error);