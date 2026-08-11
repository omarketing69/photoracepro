const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testUpload() {
  console.log('🧪 Iniciando test de subida optimizada...');
  
  // Crear un archivo de prueba simple
  const testImagePath = path.join(__dirname, 'test-image.jpg');
  const testImageData = Buffer.from('fake-image-data');
  fs.writeFileSync(testImagePath, testImageData);
  
  const formData = new FormData();
  formData.append('eventId', '1');
  formData.append('photos', fs.createReadStream(testImagePath));
  
  const startTime = Date.now();
  
  try {
    const response = await fetch('http://localhost:5000/api/photos/upload', {
      method: 'POST',
      body: formData,
      timeout: 30000 // 30 segundos timeout
    });
    
    const result = await response.json();
    const duration = Date.now() - startTime;
    
    console.log(`✅ Upload completado en ${duration}ms`);
    console.log('📊 Resultado:', result);
    
    // Limpiar archivo de prueba
    fs.unlinkSync(testImagePath);
    
  } catch (error) {
    console.error('❌ Error en upload:', error.message);
    // Limpiar archivo de prueba
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  }
}

testUpload();