import { runCloudSync } from './sync-cloud-photos';

// Ejecutar sincronización directamente
runCloudSync(3).then(() => {
  console.log('Sincronización completada');
  process.exit(0);
}).catch(error => {
  console.error('Error en sincronización:', error);
  process.exit(1);
});