import { analyzeAndReprocessEvent5 } from './server/analyze-and-reprocess-event5';

(async () => {
  console.log('🚀 Iniciando análisis y reprocesamiento...');
  const results = await analyzeAndReprocessEvent5();
  
  if (results) {
    console.log('\n📋 RESUMEN FINAL:');
    console.log(`✅ Fotos procesadas: ${results.processed}`);
    console.log(`🎯 Dorsales detectados: ${results.dorsalsFound}`);
    console.log(`📈 Efectividad: ${results.effectiveness}%`);
    console.log(`📊 Estimado total: ${results.estimatedTotal} dorsales de ${results.totalPhotos} fotos`);
  }
  
  console.log('✅ Análisis completado');
  process.exit(0);
})();