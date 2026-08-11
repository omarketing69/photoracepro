import { useState, useRef } from 'react';
import { Upload, FileArchive, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from '@/lib/queryClient';

interface ZipUploadProps {
  eventId: number;
  onUploadComplete: () => void;
}

interface UploadStatus {
  status: 'idle' | 'uploading' | 'extracting' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  extractedFiles?: number;
  processedFiles?: number;
  totalFiles?: number;
}

export default function ZipUpload({ eventId, onUploadComplete }: ZipUploadProps) {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    status: 'idle',
    progress: 0,
    message: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar que sea un archivo ZIP
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setUploadStatus({
        status: 'error',
        progress: 0,
        message: 'Por favor selecciona un archivo ZIP válido'
      });
      return;
    }

    // Validar tamaño (máximo 2GB)
    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
    if (file.size > maxSize) {
      setUploadStatus({
        status: 'error',
        progress: 0,
        message: 'El archivo es demasiado grande. Máximo permitido: 2GB'
      });
      return;
    }

    await uploadZipFile(file);
  };

  const uploadZipFile = async (file: File) => {
    try {
      setUploadStatus({
        status: 'uploading',
        progress: 0,
        message: 'Subiendo archivo ZIP...'
      });

      const formData = new FormData();
      formData.append('zipFile', file);
      formData.append('eventId', eventId.toString());

      // Crear XMLHttpRequest para poder mostrar progreso de subida
      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadStatus({
              status: 'uploading',
              progress: progress,
              message: `Subiendo archivo... ${progress}%`
            });
          }
        });

        xhr.onload = () => {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            handleUploadResponse(response);
            resolve(response);
          } else {
            reject(new Error(`Error ${xhr.status}: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error('Error de red durante la subida'));

        xhr.open('POST', '/api/photos/upload-zip');
        
        // Add authentication headers
        try {
          const userStr = localStorage.getItem('race_photo_user');
          if (userStr) {
            const user = JSON.parse(userStr);
            if (user && user.token) {
              xhr.setRequestHeader('Authorization', `Bearer ${user.token}`);
            }
          }
        } catch (error) {
          console.error('Error getting auth headers for ZIP upload:', error);
        }
        
        xhr.send(formData);
      });

    } catch (error) {
      console.error('Error uploading ZIP:', error);
      setUploadStatus({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  };

  const handleUploadResponse = (response: any) => {
    if (response.success) {
      setUploadStatus({
        status: 'extracting',
        progress: 0,
        message: 'Extrayendo fotos del archivo ZIP...',
        totalFiles: response.totalFiles
      });
      
      // Iniciar polling para obtener el progreso de extracción
      pollExtractionProgress(response.batchId);
    } else {
      setUploadStatus({
        status: 'error',
        progress: 0,
        message: response.error || 'Error al procesar el archivo ZIP'
      });
    }
  };

  const pollExtractionProgress = async (batchId: string) => {
    try {
      const response: any = await fetch(`/api/photos/batch-status/${batchId}`).then(r => r.json());
      
      if (response.status === 'extracting') {
        setUploadStatus({
          status: 'extracting',
          progress: Math.round((response.extractedFiles / response.totalFiles) * 100),
          message: `Extrayendo fotos: ${response.extractedFiles}/${response.totalFiles}`,
          extractedFiles: response.extractedFiles,
          totalFiles: response.totalFiles
        });
      } else if (response.status === 'processing') {
        setUploadStatus({
          status: 'processing',
          progress: Math.round((response.processedFiles / response.totalFiles) * 100),
          message: `Procesando fotos: ${response.processedFiles}/${response.totalFiles}`,
          processedFiles: response.processedFiles,
          totalFiles: response.totalFiles
        });
      } else if (response.status === 'completed') {
        setUploadStatus({
          status: 'completed',
          progress: 100,
          message: `¡Completado! ${response.totalFiles} fotos procesadas exitosamente`,
          totalFiles: response.totalFiles
        });
        onUploadComplete();
        return;
      } else if (response.status === 'error') {
        setUploadStatus({
          status: 'error',
          progress: 0,
          message: response.error || 'Error durante el procesamiento'
        });
        return;
      }

      // Continuar polling cada 2 segundos
      setTimeout(() => pollExtractionProgress(batchId), 2000);
      
    } catch (error) {
      console.error('Error polling progress:', error);
      setUploadStatus({
        status: 'error',
        progress: 0,
        message: 'Error al verificar el progreso'
      });
    }
  };

  const resetUpload = () => {
    setUploadStatus({
      status: 'idle',
      progress: 0,
      message: ''
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusColor = () => {
    switch (uploadStatus.status) {
      case 'completed': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'uploading':
      case 'extracting':
      case 'processing': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (uploadStatus.status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'uploading':
      case 'extracting':
      case 'processing': return <FileArchive className="h-5 w-5 text-blue-600 animate-pulse" />;
      default: return <Upload className="h-5 w-5" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileArchive className="h-5 w-5" />
          Subir Archivo ZIP con Fotos
        </CardTitle>
        <CardDescription>
          Sube un archivo ZIP con hasta 5000 fotos para procesamiento automático
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {uploadStatus.status === 'idle' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <FileArchive className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Selecciona tu archivo ZIP
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Máximo 2GB, formato ZIP únicamente
              </p>
              <Button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto"
              >
                <Upload className="mr-2 h-4 w-4" />
                Seleccionar Archivo ZIP
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Formato recomendado:</strong> Las fotos deben estar en formato JPG, PNG o TIFF. 
                El sistema extraerá automáticamente las fotos y las procesará para detectar dorsales y caras.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {uploadStatus.status !== 'idle' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className={`font-medium ${getStatusColor()}`}>
                  {uploadStatus.message}
                </span>
              </div>
              {uploadStatus.status === 'completed' || uploadStatus.status === 'error' ? (
                <Button variant="outline" size="sm" onClick={resetUpload}>
                  <X className="h-4 w-4 mr-2" />
                  Cerrar
                </Button>
              ) : null}
            </div>

            {uploadStatus.progress > 0 && (
              <Progress value={uploadStatus.progress} className="w-full" />
            )}

            {uploadStatus.totalFiles && (
              <div className="text-sm text-gray-600">
                {uploadStatus.status === 'extracting' && uploadStatus.extractedFiles && (
                  <p>Archivos extraídos: {uploadStatus.extractedFiles} de {uploadStatus.totalFiles}</p>
                )}
                {uploadStatus.status === 'processing' && uploadStatus.processedFiles && (
                  <p>Fotos procesadas: {uploadStatus.processedFiles} de {uploadStatus.totalFiles}</p>
                )}
                {uploadStatus.status === 'completed' && (
                  <p>Total procesado: {uploadStatus.totalFiles} fotos</p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}