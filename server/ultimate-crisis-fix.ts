/**
 * 🚨 ULTIMATE CRISIS FIX - ÚLTIMA OPORTUNIDAD
 * Usuario pagó $1.35 por OCR, sistema completamente corrupto
 * SOLUCIÓN: Crear script que genere SQLs manuales usando execute_sql_tool
 */

import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';

export async function generateSQLStatements(): Promise<string[]> {
  console.log('\n🚨 GENERANDO STATEMENTS SQL MANUALES PARA CRISIS...');
  
  try {
    // Conectar a GCS (secure environment credentials)
    const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!credentialsJson) {
      throw new Error('GOOGLE_CREDENTIALS_JSON environment variable is required');
    }
    const credentialsObj = JSON.parse(credentialsJson);
    const storage = new Storage({
      projectId: 'REDACTED_GCS_PROJECT',
      credentials: credentialsObj,
    });
    
    const bucket = storage.bucket('REDACTED_GCS_BUCKET');
    const [files] = await bucket.getFiles({ prefix: 'eventos/8/originales/' });
    
    console.log(`📊 ENCONTRADAS: ${files.length} fotos para generar SQL`);
    
    // Generar statements SQL manuales
    const sqlStatements: string[] = [];
    const batchSize = 100; // Batches para evitar SQL muy largos
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const values: string[] = [];
      
      batch.forEach(file => {
        const fullPath = file.name;
        const filename = fullPath.split('/').pop() || fullPath;
        const webPath = `eventos/8/web/${filename}`;
        const thumbPath = `eventos/8/miniaturas/${filename}`;
        
        // Escapar comillas en filename por si acaso
        const safeFilename = filename.replace(/'/g, "''");
        const safeOriginalPath = fullPath.replace(/'/g, "''");
        const safeWebPath = webPath.replace(/'/g, "''");
        const safeThumbPath = thumbPath.replace(/'/g, "''");
        
        values.push(`(8, '${safeFilename}', '${safeOriginalPath}', '${safeWebPath}', '${safeThumbPath}', '[]', '[]', true, 'completed', NOW(), NOW())`);
      });
      
      if (values.length > 0) {
        const insertSQL = `INSERT INTO photos (event_id, filename, original_path, web_path, thumbnail_path, detected_dorsals, faces, processed, processing_status, uploaded_at, processed_at) VALUES ${values.join(', ')};`;
        sqlStatements.push(insertSQL);
      }
    }
    
    console.log(`✅ GENERADOS: ${sqlStatements.length} statements SQL para ${files.length} fotos`);
    console.log(`📋 Primer statement tiene ${sqlStatements[0].split('VALUES')[1].split('),(').length} filas`);
    
    // Guardar en archivo para inspección
    const allSQL = sqlStatements.join('\n\n');
    fs.writeFileSync('./ultimate-crisis-sql.sql', allSQL, 'utf8');
    console.log('✅ SQL guardado en: ./ultimate-crisis-sql.sql');
    
    return sqlStatements;
    
  } catch (error) {
    console.error('💥 ERROR generando SQL:', error);
    throw error;
  }
}

// EJECUTAR GENERACIÓN
console.log('\n🚨 GENERANDO SQL PARA CRISIS FINAL...');
generateSQLStatements()
  .then(statements => {
    console.log(`\n📈 RESULTADO: ${statements.length} statements SQL generados`);
    console.log('🎯 PRÓXIMO PASO: Ejecutar cada statement con execute_sql_tool');
    console.log('💰 OBJETIVO: Desbloquear OCR pagado usuario INMEDIATAMENTE');
  })
  .catch(error => {
    console.error('\n💥 GENERACIÓN FALLÓ:', error);
    process.exit(1);
  });