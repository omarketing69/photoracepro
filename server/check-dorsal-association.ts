import { storage } from './storage';

export async function checkDorsalAssociation(eventId: number, dorsal: number) {
  console.log(`🔍 DORSAL CHECK: Looking for dorsal ${dorsal} in event ${eventId}`);
  
  // Get all photos for event
  const allPhotos = await storage.getPhotos(eventId);
  console.log(`📸 Total photos in event ${eventId}: ${allPhotos.length}`);
  
  // Filter photos with detected dorsals
  const photosWithDorsals = allPhotos.filter(p => p.detectedDorsals && p.detectedDorsals.length > 0);
  console.log(`🔢 Photos with detected dorsals: ${photosWithDorsals.length}`);
  
  // Find photos with specific dorsal
  const photosWithTargetDorsal = allPhotos.filter(p => 
    p.detectedDorsals && p.detectedDorsals.includes(dorsal)
  );
  console.log(`🎯 Photos with dorsal ${dorsal}: ${photosWithTargetDorsal.length}`);
  
  // Get sample of detected dorsals
  const allDetectedDorsals = new Set();
  photosWithDorsals.forEach(p => {
    p.detectedDorsals?.forEach(d => allDetectedDorsals.add(d));
  });
  
  console.log(`📊 Unique dorsals detected: ${allDetectedDorsals.size}`);
  console.log(`🔍 Sample dorsals:`, Array.from(allDetectedDorsals).slice(0, 10));
  
  return {
    eventId,
    totalPhotos: allPhotos.length,
    photosWithDorsals: photosWithDorsals.length,
    photosWithTargetDorsal: photosWithTargetDorsal.length,
    uniqueDorsalsCount: allDetectedDorsals.size,
    sampleDorsals: Array.from(allDetectedDorsals).slice(0, 10),
    targetDorsalExists: allDetectedDorsals.has(dorsal)
  };
}