import { useState, useRef, useCallback } from 'react';
import { Upload, Image, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from '@/lib/queryClient';

interface PhotoUploadProps {
  eventId: number;
  onUploadComplete: () => void;
}

interface UploadedFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

export default function PhotoUpload({ eventId, onUploadComplete }: PhotoUploadProps) {
  const [lastUploadResult, setLastUploadResult] = useState<any>(null);
  const [showForceUpload, setShowForceUpload] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    // 📱 CRITICAL FIX: Add HEIC/HEIF support for iPhone photos
    const validTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 
      'image/bmp', 'image/webp', 'image/gif',
      'image/heic', 'image/heif'  // 🎉 iPhone photo support added!
    ];
    const maxSize = 50 * 1024 * 1024; // 50MB por archivo

    if (!validTypes.includes(file.type)) {
      console.log(`🚨 [VALIDATION] File type rejected: ${file.type} for file: ${file.name}`);
      console.log(`🚨 [VALIDATION] Accepted types:`, validTypes);
      return false;
    }

    if (file.size > maxSize) {
      console.log(`🚨 [VALIDATION] File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB for file: ${file.name}`);
      return false;
    }

    console.log(`✅ [VALIDATION] File accepted: ${file.name} (${file.type})`);
    return true;
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const validFiles: UploadedFile[] = [];
    
    Array.from(newFiles).forEach((file) => {
      if (validateFile(file)) {
        validFiles.push({
          file,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          status: 'pending',
          progress: 0
        });
      }
    });

    setFiles(prev => [...prev, ...validFiles]);
  }, []);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadFiles = async (forceDuplicates = false) => {
    console.log('🔧 [MOBILE DEBUG] === INICIO UPLOAD FUNCTION ===');
    console.log('🔧 [MOBILE DEBUG] User Agent:', navigator.userAgent);
    console.log('🔧 [MOBILE DEBUG] EventId:', eventId);
    console.log('🔧 [MOBILE DEBUG] ForceDuplicates:', forceDuplicates);
    
    setIsUploading(true);
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    console.log('🔧 [MOBILE DEBUG] Files selected:', pendingFiles.length);
    pendingFiles.forEach((file, index) => {
      console.log(`🔧 [MOBILE DEBUG] File ${index + 1}:`, {
        name: file.file.name,
        size: file.file.size,
        type: file.file.type
      });
    });
    
    if (pendingFiles.length === 0) {
      console.log('🔧 [MOBILE DEBUG] No pending files, aborting');
      setIsUploading(false);
      return;
    }

    try {
      console.log('🔧 [MOBILE DEBUG] === CREATING FORMDATA ===');
      const formData = new FormData();
      
      pendingFiles.forEach((file, index) => {
        console.log(`🔧 [MOBILE DEBUG] Appending file ${index + 1} to FormData`);
        formData.append('photos', file.file);
      });
      formData.append('eventId', eventId.toString());
      
      if (forceDuplicates) {
        formData.append('forceDuplicates', 'true');
      }
      
      console.log('🔧 [MOBILE DEBUG] FormData created successfully');
      console.log('🔧 [MOBILE DEBUG] FormData entries:');
      // Safe FormData iteration for older TypeScript targets
      const entries = Array.from(formData.entries());
      entries.forEach(([key, value]) => {
        console.log('🔧 [MOBILE DEBUG] -', key, ':', value instanceof File ? `File: ${value.name}` : value);
      });

      console.log(`📤 Subiendo ${pendingFiles.length} fotos desde dashboard...`);
      console.log(`⚡ Forzar duplicados: ${forceDuplicates}`);
      console.log('🔧 [MOBILE DEBUG] === CALLING API REQUEST ===');
      console.log('🔧 [MOBILE DEBUG] URL: /api/photos/upload');
      console.log('🔧 [MOBILE DEBUG] Method: POST');
      console.log('🔧 [MOBILE DEBUG] Data type:', typeof formData);

      let response: Response;
      
      try {
        // Intentar endpoint normal primero
        response = await apiRequest('POST', '/api/photos/upload', formData);
        console.log('🔧 [MOBILE DEBUG] === API REQUEST RESPONSE (NORMAL) ===');
        console.log('🔧 [MOBILE DEBUG] Response status:', response.status);
        console.log('🔧 [MOBILE DEBUG] Response ok:', response.ok);
      } catch (normalError) {
        console.log('🚨 [MOBILE DEBUG] NORMAL ENDPOINT FAILED, TRYING EMERGENCY...');
        console.log('🚨 [MOBILE DEBUG] Normal error:', normalError);
        
        // Si falla, usar endpoint de emergencia sin autenticación
        try {
          response = await fetch('/api/emergency/mobile-upload', {
            method: 'POST',
            body: formData, // FormData directly
            credentials: 'include'
          });
          
          console.log('🚨 [EMERGENCY] === API REQUEST RESPONSE (EMERGENCY) ===');
          console.log('🚨 [EMERGENCY] Response status:', response.status);
          console.log('🚨 [EMERGENCY] Response ok:', response.ok);
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Emergency endpoint failed: ${response.status} - ${errorText}`);
          }
        } catch (emergencyError) {
          console.log('🚨 [EMERGENCY] EMERGENCY ENDPOINT ALSO FAILED!');
          console.log('🚨 [EMERGENCY] Emergency error:', emergencyError);
          throw new Error(`Both endpoints failed. Normal: ${normalError instanceof Error ? normalError.message : String(normalError)}. Emergency: ${emergencyError instanceof Error ? emergencyError.message : String(emergencyError)}`);
        }
      }

      const result = await response.json();

      if (response.ok) {
        setFiles(prev => prev.map(f => 
          pendingFiles.find(pf => pf.id === f.id) 
            ? { ...f, status: 'success' as const, progress: 100 }
            : f
        ));
        
        setLastUploadResult(result);
        
        // Mostrar botón de forzar si hay duplicados
        if (result.performance?.duplicates > 0) {
          setShowForceUpload(true);
        }
        
        onUploadComplete();
      } else {
        setFiles(prev => prev.map(f => 
          pendingFiles.find(pf => pf.id === f.id) 
            ? { ...f, status: 'error' as const, error: result.message || 'Error al subir' }
            : f
        ));
      }
    } catch (error) {
      console.log('🔧 [MOBILE DEBUG] === ERROR CATCH BLOCK ===');
      console.error('🚨 [MOBILE DEBUG] Error uploading files:', error);
      console.log('🚨 [MOBILE DEBUG] Error type:', typeof error);
      console.log('🚨 [MOBILE DEBUG] Error message:', error instanceof Error ? error.message : String(error));
      console.log('🚨 [MOBILE DEBUG] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      setFiles(prev => prev.map(f => 
        pendingFiles.find(pf => pf.id === f.id) 
          ? { ...f, status: 'error' as const, error: `Error: ${error instanceof Error ? error.message : String(error)}` }
          : f
      ));
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadAll = () => uploadFiles(false);
  const handleForceUpload = () => uploadFiles(true);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      addFiles(e.target.files);
    }
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'uploading': return <Upload className="h-4 w-4 text-blue-600 animate-pulse" />;
      default: return <Image className="h-4 w-4 text-gray-400" />;
    }
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        {/* Event Confirmation Banner */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <div className="flex items-center">
            <div className="bg-green-500 text-white px-2 py-1 rounded text-xs font-medium mr-2">
              ✓ DESTINO
            </div>
            <p className="text-sm text-green-800">
              <strong>Las fotos se subirán al Evento ID: {eventId}</strong>
            </p>
          </div>
        </div>
        
        <div className="space-y-4">
          {/* Área de drag & drop */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              Arrastra y suelta fotos aquí
            </p>
            <p className="text-sm text-gray-500 mb-4">
              O haz clic para seleccionar archivos
            </p>
            <Button 
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              Seleccionar Archivos
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Lista de archivos */}
          {files.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">
                  Archivos seleccionados ({files.length})
                </h4>
                {pendingCount > 0 && (
                  <Button 
                    onClick={handleUploadAll}
                    disabled={isUploading}
                    size="sm"
                  >
                    Subir Todo ({pendingCount})
                  </Button>
                )}
              </div>

              {/* Resumen de estado */}
              {(successCount > 0 || errorCount > 0) && (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-green-600">
                    ✓ Exitosos: {successCount}
                  </div>
                  <div className="text-blue-600">
                    ↗ Pendientes: {pendingCount}
                  </div>
                  <div className="text-red-600">
                    ✗ Errores: {errorCount}
                  </div>
                </div>
              )}

              {/* Lista de archivos */}
              <div className="max-h-60 overflow-y-auto space-y-2">
                {files.map((uploadedFile) => (
                  <div key={uploadedFile.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    {getStatusIcon(uploadedFile.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {uploadedFile.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {uploadedFile.status === 'uploading' && (
                        <Progress value={uploadedFile.progress} className="mt-1 h-1" />
                      )}
                      {uploadedFile.error && (
                        <p className="text-xs text-red-600 mt-1">{uploadedFile.error}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(uploadedFile.id)}
                      disabled={uploadedFile.status === 'uploading'}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Información importante */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Formatos soportados:</strong> JPG, PNG, TIFF, BMP, WebP. 
              <strong>Tamaño máximo:</strong> 50MB por archivo.
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
}