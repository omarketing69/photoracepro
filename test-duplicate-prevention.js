// Test script to validate duplicate prevention system
import { uploadResumeSystem } from './server/upload-resume-system.js';

async function testDuplicatePreventionSystem() {
  console.log('🧪 INICIANDO PRUEBA DE PREVENCIÓN DE DUPLICADOS');
  
  const eventId = 1;
  
  try {
    // Test 1: Check if existing file is detected as duplicate
    console.log('\n📋 PRUEBA 1: Verificar detección de archivo existente');
    const testFilename = '1752501798661-anderson-512.jpg';
    
    console.log(`Verificando archivo: ${testFilename}`);
    const duplicateCheck = await uploadResumeSystem.checkAllDuplicates(eventId, testFilename);
    
    console.log('Resultado:');
    console.log(`  - En base de datos: ${duplicateCheck.inDatabase}`);
    console.log(`  - En Google Cloud: ${duplicateCheck.inCloud}`);
    console.log(`  - Es duplicado: ${duplicateCheck.isDuplicate}`);
    
    // Test 2: Check validation system
    console.log('\n📋 PRUEBA 2: Validar sistema completo');
    const validation = await uploadResumeSystem.validateDuplicatePreventionSystem(eventId);
    
    console.log('Resultado de validación:');
    console.log(`  - Sistema funcionando: ${validation.isWorking}`);
    console.log(`  - Detección en BD: ${validation.testResults.databaseCheck}`);
    console.log(`  - Detección en Cloud: ${validation.testResults.cloudCheck}`);
    console.log(`  - Verificación combinada: ${validation.testResults.combinedCheck}`);
    
    if (validation.recommendations.length > 0) {
      console.log('  - Recomendaciones:');
      validation.recommendations.forEach(rec => {
        console.log(`    * ${rec}`);
      });
    }
    
    console.log('\n✅ PRUEBA COMPLETADA');
    
  } catch (error) {
    console.error('❌ ERROR EN PRUEBA:', error);
  }
}

testDuplicatePreventionSystem().then(() => {
  console.log('🏁 Prueba finalizada');
  process.exit(0);
}).catch(err => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});