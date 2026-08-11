import { fixEvent5Sync } from './server/fix-event5-sync';

(async () => {
  console.log('🚀 Iniciando reparación de sincronización...');
  await fixEvent5Sync();
  console.log('✅ Sincronización completada');
  process.exit(0);
})();