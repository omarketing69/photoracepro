import { runEmergencyRecovery } from './emergency-event8-ocr-recovery';

console.log(`🚨 STARTING EMERGENCY EVENT 8 OCR RECOVERY`);
console.log(`💰 Recovering $1.35 worth of OCR processing`);
console.log(`🎯 Target: 376 dorsals from 898 photos`);

runEmergencyRecovery()
  .then(() => {
    console.log(`\n🎉 EMERGENCY RECOVERY COMPLETED`);
  })
  .catch(error => {
    console.error(`❌ EMERGENCY RECOVERY FAILED:`, error);
  });