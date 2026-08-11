import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, Upload, AlertCircle, CheckCircle } from 'lucide-react';

export default function MobileUploadTest() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `${timestamp}: ${message}`]);
    console.log(`📱 Test: ${message}`);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      addLog(`Archivo seleccionado: ${file.name} (${file.size} bytes, ${file.type})`);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Selecciona una foto primero');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);
    
    addLog('Iniciando subida de prueba...');

    try {
      const formData = new FormData();
      formData.append('photos', selectedFile);
      formData.append('eventId', '4'); // Evento de prueba

      addLog(`Enviando FormData con ${formData.get('photos') ? 'archivo' : 'sin archivo'}`);
      addLog(`User-Agent: ${navigator.userAgent}`);

      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData,
      });

      addLog(`Respuesta recibida: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        addLog(`Error del servidor: ${errorText}`);
        setError(`Error ${response.status}: ${errorText}`);
        return;
      }

      const data = await response.json();
      addLog(`Subida exitosa: ${JSON.stringify(data)}`);
      setResult(data);

    } catch (err: any) {
      addLog(`Error de red: ${err.message}`);
      setError(`Error de conexión: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setError(null);
    setResult(null);
    setSelectedFile(null);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🔧 Prueba de Subida Móvil
          </h1>
          <p className="text-gray-600">
            Herramienta de diagnóstico para probar subidas desde dispositivos móviles
          </p>
        </div>

        {/* Información del dispositivo */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Información del Dispositivo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>User-Agent:</strong> {navigator.userAgent}</p>
              <p><strong>Es móvil:</strong> {/Mobile|Android|iPhone|iPad|iPod|BlackBerry|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent) ? 'Sí' : 'No'}</p>
              <p><strong>Conexión:</strong> {(navigator as any).connection?.effectiveType || 'Desconocida'}</p>
              <p><strong>Soporte de archivos:</strong> {typeof FileReader !== 'undefined' ? 'Sí' : 'No'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Selector de archivo */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Seleccionar Foto de Prueba
            </CardTitle>
            <CardDescription>
              Selecciona una foto para probar la subida
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer"
            />
            
            {selectedFile && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Archivo:</strong> {selectedFile.name}<br />
                  <strong>Tamaño:</strong> {(selectedFile.size / (1024*1024)).toFixed(2)} MB<br />
                  <strong>Tipo:</strong> {selectedFile.type}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botón de subida */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Button 
                onClick={handleUpload} 
                disabled={!selectedFile || uploading}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Subiendo...' : 'Probar Subida'}
              </Button>
              
              <Button variant="outline" onClick={clearLogs}>
                Limpiar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resultados */}
        {error && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <Alert className="mb-6">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              ✅ Subida exitosa: {result.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Logs de Depuración</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-3 rounded-lg max-h-60 overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index} className="text-xs text-gray-700 mb-1 font-mono">
                    {log}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}