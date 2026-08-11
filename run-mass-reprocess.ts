import { massReprocessEvent5 } from './server/mass-reprocess-event5';

(async () => {
  console.log('🚀 Iniciando reprocesamiento masivo...');
  const results = await massReprocessEvent5();
  
  if (results) {
    console.log('\n📋 RESUMEN FINAL DEL REPROCESAMIENTO:');
    console.log(`✅ Fotos procesadas: ${results.processed}`);
    console.log(`🎯 Dorsales detectados: ${results.dorsalsFound}`);
    console.log(`📈 Efectividad: ${results.effectiveness}%`);
    console.log(`📊 Estimado total: ${results.estimatedTotal} dorsales`);
    console.log(`🆙 Mejora: +${results.estimatedTotal - 72} dorsales vs antes`);
  }
  
  console.log('✅ Reprocesamiento masivo completado');
  process.exit(0);
})();