// Test para verificar que el error 413 está resuelto
const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testUploadSizeLimits() {
  console.log('🧪 Testing upload size limits...');
  
  // Crear un archivo de imagen simulado de 1MB
  const smallImage = Buffer.alloc(1024 * 1024, 0); // 1MB
  fs.writeFileSync('test-small.jpg', smallImage);
  
  // Crear un archivo de imagen simulado de 10MB 
  const largeImage = Buffer.alloc(10 * 1024 * 1024, 0); // 10MB
  fs.writeFileSync('test-large.jpg', largeImage);
  
  // Test 1: Archivo pequeño (1MB)
  console.log('📤 Testing 1MB file...');
  await testSingleFile('test-small.jpg', '1MB');
  
  // Test 2: Archivo grande (10MB)
  console.log('📤 Testing 10MB file...');
  await testSingleFile('test-large.jpg', '10MB');
  
  // Test 3: Múltiples archivos pequeños
  console.log('📤 Testing multiple small files...');
  await testMultipleFiles();
  
  // Limpiar archivos
  fs.unlinkSync('test-small.jpg');
  fs.unlinkSync('test-large.jpg');
}

async function testSingleFile(filename, size) {
  const formData = new FormData();
  formData.append('eventId', '1');
  formData.append('photos', fs.createReadStream(filename), {
    filename: filename,
    contentType: 'image/jpeg'
  });
  
  try {
    const response = await fetch('http://localhost:5000/api/photos/upload', {
      method: 'POST',
      body: formData,
      timeout: 30000
    });
    
    if (response.status === 413) {
      console.log(`❌ ${size} file: Error 413 - Request Entity Too Large`);
      const errorText = await response.text();
      console.log(`   Error details: ${errorText}`);
    } else if (response.status === 500) {
      console.log(`⚠️  ${size} file: Error 500 - Expected (not real image)`);
    } else {
      console.log(`✅ ${size} file: Status ${response.status} - Size limit OK`);
    }
  } catch (error) {
    console.log(`❌ ${size} file: Network error - ${error.message}`);
  }
}

async function testMultipleFiles() {
  const formData = new FormData();
  formData.append('eventId', '1');
  
  // Agregar 5 archivos de 1MB cada uno
  for (let i = 0; i < 5; i++) {
    formData.append('photos', fs.createReadStream('test-small.jpg'), {
      filename: `test-multiple-${i}.jpg`,
      contentType: 'image/jpeg'
    });
  }
  
  try {
    const response = await fetch('http://localhost:5000/api/photos/upload', {
      method: 'POST',
      body: formData,
      timeout: 30000
    });
    
    if (response.status === 413) {
      console.log(`❌ Multiple files: Error 413 - Request Entity Too Large`);
      const errorText = await response.text();
      console.log(`   Error details: ${errorText}`);
    } else if (response.status === 500) {
      console.log(`⚠️  Multiple files: Error 500 - Expected (not real images)`);
    } else {
      console.log(`✅ Multiple files: Status ${response.status} - Size limit OK`);
    }
  } catch (error) {
    console.log(`❌ Multiple files: Network error - ${error.message}`);
  }
}

testUploadSizeLimits();