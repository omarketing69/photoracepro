#!/usr/bin/env tsx

/**
 * Focus script to complete Event 8 thumbnail generation and fix database paths
 */

import { getCloudStorage } from './server/cloud-storage';
import { db } from './server/db';
import { photos } from './shared/schema';
import { eq } from 'drizzle-orm';

async function fixEvent8Thumbnails() {
  console.log('🔧 Fixing Event 8 thumbnail issues...\n');

  try {
    // 1. First, let's check and fix the database path corruption
    console.log('1️⃣ Checking database path corruption...');
    
    const event8Photos = await db
      .select()
      .from(photos)
      .where(eq(photos.eventId, 8))
      .limit(5);

    console.log(`📊 Found ${event8Photos.length} sample photos to check paths`);
    
    for (const photo of event8Photos) {
      console.log(`\n📋 Photo ${photo.id}: ${photo.filename}`);
      console.log(`   Original: ${photo.originalPath}`);
      console.log(`   Web: ${photo.webPath || 'null'}`);
      console.log(`   Thumbnail: ${photo.thumbnailPath || 'null'}`);

      // Check if paths are corrupted (contain duplicate segments)
      let needsUpdate = false;
      let newWebPath = photo.webPath;
      let newThumbnailPath = photo.thumbnailPath;

      if (photo.webPath && photo.webPath.includes('eventos/8/web/eventos/8/')) {
        newWebPath = photo.webPath.replace('eventos/8/web/eventos/8/', 'eventos/8/web/');
        needsUpdate = true;
        console.log(`   🔧 Web path fix: ${newWebPath}`);
      }

      if (photo.thumbnailPath && photo.thumbnailPath.includes('eventos/8/miniaturas/eventos/8/')) {
        newThumbnailPath = photo.thumbnailPath.replace('eventos/8/miniaturas/eventos/8/', 'eventos/8/miniaturas/');
        needsUpdate = true;
        console.log(`   🔧 Thumbnail path fix: ${newThumbnailPath}`);
      }

      if (needsUpdate) {
        await db
          .update(photos)
          .set({
            webPath: newWebPath,
            thumbnailPath: newThumbnailPath
          })
          .where(eq(photos.id, photo.id));
        
        console.log(`   ✅ Updated paths for photo ${photo.id}`);
      }
    }

    // 2. Now continue the thumbnail generation (focused approach)
    console.log('\n2️⃣ Continuing thumbnail generation...');
    
    const cloudStorage = getCloudStorage();
    const bucket = cloudStorage['storage'].bucket(cloudStorage['bucketName']);
    
    // Get first 50 original files to process
    const [originalFiles] = await bucket.getFiles({ 
      prefix: 'eventos/8/originales/',
      maxResults: 50 
    });

    console.log(`📄 Found ${originalFiles.length} original files to process`);

    let processed = 0;
    let generated = 0;

    for (const originalFile of originalFiles) {
      try {
        processed++;
        const originalPath = originalFile.name;
        const filename = originalPath.split('/').pop();
        
        if (!filename) continue;

        console.log(`🖼️ Processing ${processed}/${originalFiles.length}: ${filename}`);

        // Check if thumbnail exists
        const thumbnailPath = `eventos/8/miniaturas/${filename}`;
        const webPath = `eventos/8/web/${filename}`;
        
        const [thumbnailExists] = await bucket.file(thumbnailPath).exists();
        const [webExists] = await bucket.file(webPath).exists();

        if (thumbnailExists && webExists) {
          console.log(`✅ ${filename}: already exists`);
          continue;
        }

        // Download and process
        const [originalBuffer] = await originalFile.download();
        
        // Generate thumbnails using sharp (import dynamically)
        const sharp = (await import('sharp')).default;

        if (!webExists) {
          const webBuffer = await sharp(originalBuffer)
            .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85, progressive: true })
            .toBuffer();

          await bucket.file(webPath).save(webBuffer, {
            metadata: {
              contentType: 'image/jpeg',
              metadata: {
                eventId: '8',
                version: 'web',
                optimized: 'true',
                generatedBy: 'fix-script'
              }
            }
          });

          console.log(`🌐 Generated web: ${webPath}`);
          generated++;
        }

        if (!thumbnailExists) {
          const thumbnailBuffer = await sharp(originalBuffer)
            .resize(200, 200, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toBuffer();

          await bucket.file(thumbnailPath).save(thumbnailBuffer, {
            metadata: {
              contentType: 'image/jpeg',
              metadata: {
                eventId: '8',
                version: 'thumbnail',
                size: '200x200',
                generatedBy: 'fix-script'
              }
            }
          });

          console.log(`🔍 Generated thumbnail: ${thumbnailPath}`);
          generated++;
        }

      } catch (error) {
        console.error(`❌ Error processing ${originalFile.name}:`, error);
      }

      // Add small delay to avoid rate limits
      if (processed % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`\n✅ Batch completed:`);
    console.log(`   - Processed: ${processed} files`);
    console.log(`   - Generated: ${generated} new files`);

    console.log('\n🎉 Event 8 thumbnail fix completed!');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

// Run the fix
fixEvent8Thumbnails().catch(console.error);