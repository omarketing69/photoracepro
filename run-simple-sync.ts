import { simpleSyncEvent5 } from './server/simple-sync-event5';

(async () => {
  console.log('🚀 Iniciando sincronización simple...');
  await simpleSyncEvent5();
  console.log('✅ Sincronización simple completada');
  process.exit(0);
})();