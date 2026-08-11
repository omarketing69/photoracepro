import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import NavigationHeader from '@/components/navigation-header';
import PhotographerNavigation from '@/components/photographer-navigation';
import { Upload, FileImage, CheckCircle, AlertCircle, Eye, Calendar, X, Camera } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface UploadedFile extends File {
  preview?: string;
}

interface UploadResult {
  success: boolean;
  message: string;
  filesCount: number;
  eventId: number;
  uploaded?: number;
  failed?: number;
  photos?: any[];
  errors?: string[];
}

export default function BulkUploadPage({ onLogout, userRole, currentUser }: { onLogout: () => void; userRole?: string; currentUser?: any }) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedEventName, setSelectedEventName] = useState<string>('');
  const [currentBatch, setCurrentBatch] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [skipCompression, setSkipCompression] = useState(false);
  const [useSimpleUpload, setUseSimpleUpload] = useState(false);
  
  // Función de cancelación de emergencia
  const cancelUpload = () => {
    if (abortController) {
      abortController.abort();
    }
    setUploading(false);
    setAbortController(null);
    setCurrentBatch('Subida cancelada por el usuario');
    setError('Subida cancelada');
  };

  // Función para comprimir imágenes en móviles (simplificada para evitar bloqueos)
  const compressImageForMobile = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      // 📱 CRITICAL FIX: Skip compression for HEIC/HEIF files (browsers can't decode them)
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.heic') || fileName.endsWith('.heif') || 
          file.type === 'image/heic' || file.type === 'image/heif') {
        console.log(`📱 [HEIC] Skipping compression for iPhone photo: ${file.name}`);
        resolve(file);
        return;
      }
      
      // Timeout de 30 segundos por imagen para evitar bloqueos
      const timeout = setTimeout(() => {
        console.error(`⏰ Timeout comprimiendo ${file.name}, usando archivo original`);
        resolve(file);
      }, 30000);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onerror = () => {
        console.error(`❌ Error cargando imagen ${file.name}, usando archivo original`);
        clearTimeout(timeout);
        resolve(file);
      };
      
      img.onload = () => {
        try {
          clearTimeout(timeout);
          
          const MAX_WIDTH = 1920;
          const MAX_HEIGHT = 1920;
          let { width, height } = img;
          
          // Solo comprimir si la imagen es muy grande
          if (width <= MAX_WIDTH && height <= MAX_HEIGHT && file.size < 5 * 1024 * 1024) {
            console.log(`📱 ${file.name} no necesita compresión`);
            resolve(file);
            return;
          }
          
          // Redimensionar si es necesario
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob && blob.size < file.size) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              console.log(`📱 Comprimido: ${file.name} de ${(file.size/1024/1024).toFixed(1)}MB a ${(blob.size/1024/1024).toFixed(1)}MB`);
              resolve(compressedFile);
            } else {
              console.log(`📱 Compresión no efectiva para ${file.name}, usando original`);
              resolve(file);
            }
          }, 'image/jpeg', 0.8);
        } catch (error) {
          console.error(`❌ Error comprimiendo ${file.name}:`, error);
          clearTimeout(timeout);
          resolve(file);
        }
      };
      
      try {
        img.src = URL.createObjectURL(file);
      } catch (error) {
        console.error(`❌ Error creando URL para ${file.name}:`, error);
        clearTimeout(timeout);
        resolve(file);
      }
    });
  };

  // Fetch events for selection
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['/api/events'],
    queryFn: async () => {
      console.log('🔧 [PHOTOGRAPHER DEBUG] Loading events with apiRequest for proper auth');
      const response = await apiRequest('GET', '/api/events');
      if (!response.ok) throw new Error('Error cargando eventos');
      return response.json();
    }
  });

  // Auto-select assigned event for photographers, or most recent event for admins
  useEffect(() => {
    if (userRole === 'photographer' && currentUser?.assignedEventId && !selectedEventId) {
      const assignedEvent = events.find((e: any) => e.id === currentUser.assignedEventId);
      setSelectedEventId(currentUser.assignedEventId.toString());
      setSelectedEventName(assignedEvent?.name || 'Evento asignado');
      console.log(`📸 Bulk Upload: Auto-selected photographer event ${currentUser.assignedEventId} (${assignedEvent?.name})`);
    } else if (userRole === 'admin' && events.length > 0 && !selectedEventId) {
      const mostRecentEvent = events.reduce((latest: any, current: any) => 
        current.id > latest.id ? current : latest
      );
      setSelectedEventId(mostRecentEvent.id.toString());
      setSelectedEventName(mostRecentEvent.name);
      console.log(`📸 Bulk Upload: Auto-selected most recent event ${mostRecentEvent.id} (${mostRecentEvent.name})`);
    }
  }, [userRole, currentUser, selectedEventId, events]);

  // Update event name when selection changes
  useEffect(() => {
    if (selectedEventId && events.length > 0) {
      const selectedEvent = events.find((e: any) => e.id.toString() === selectedEventId);
      if (selectedEvent) {
        setSelectedEventName(selectedEvent.name);
      }
    }
  }, [selectedEventId, events]);

  // Filter events based on user role - photographers can see all events but with indication
  const availableEvents = useMemo(() => {
    // Allow photographers to see all events
    return events;
  }, [events]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    console.log('📱 onDrop called with files:', acceptedFiles.length, acceptedFiles.map(f => f.name));
    
    // 📱 CRITICAL FIX: Include HEIC/HEIF for iPhone photos (same as admin)
    const imageFiles = acceptedFiles.filter(file => {
      // Check by MIME type first
      if (file.type.startsWith('image/') && 
          ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/gif', 'image/webp', 'image/bmp', 'image/heic', 'image/heif'].includes(file.type)) {
        return true;
      }
      
      // Check by file extension for HEIC/HEIF files that might not have correct MIME type
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
        console.log(`📱 [HEIC] Detected iPhone photo by extension: ${file.name} (MIME: ${file.type})`);
        return true;
      }
      
      // Other image types by MIME type fallback
      return file.type.startsWith('image/');
    });

    console.log('📱 Filtered image files:', imageFiles.length, imageFiles.map(f => `${f.name} (${f.type})`));

    const filesWithPreview = imageFiles.map(file => 
      Object.assign(file, {
        preview: URL.createObjectURL(file)
      })
    );

    setFiles(prev => [...prev, ...filesWithPreview]);
    setError(null);
    
    if (imageFiles.length > 0) {
      console.log('✅ Successfully added', imageFiles.length, 'files to upload queue');
    } else {
      console.log('❌ No valid image files found in selection');
    }
  }, []);

  // 📱 CRITICAL FIX: Add HEIC/HEIF support for iPhone dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/tiff': ['.tiff', '.tif'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'], 
      'image/bmp': ['.bmp'],
      'image/heic': ['.heic'],
      'image/heif': ['.heif']
    },
    multiple: true,
    noClick: false,
    noKeyboard: false,
    disabled: false,
    preventDropOnDocument: true
  });

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  // Función simple como Dashboard (sin lotes ni compresión)
  const uploadFilesSimple = async (forceDuplicates = false) => {
    if (files.length === 0) {
      setError('Selecciona al menos una foto para subir');
      return;
    }

    if (!selectedEventId) {
      setError('Selecciona un evento para subir las fotos');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setUploadResult(null);

    try {
      console.log(`📤 Subida simple: ${files.length} fotos (igual que Dashboard)`);
      
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('photos', file);
      });
      formData.append('eventId', selectedEventId);
      
      if (forceDuplicates) {
        formData.append('forceDuplicates', 'true');
      }

      // 🔧 CRITICAL FIX: Use apiRequest for authentication like admin interface + emergency fallback
      let response: Response;
      
      try {
        console.log('🔧 [PHOTOGRAPHER DEBUG] Trying normal endpoint with apiRequest');
        response = await apiRequest('POST', '/api/photos/upload', formData);
        console.log('🔧 [PHOTOGRAPHER DEBUG] Normal endpoint response:', response.status, response.ok);
      } catch (normalError) {
        console.log('🚨 [PHOTOGRAPHER DEBUG] NORMAL ENDPOINT FAILED, TRYING EMERGENCY...');
        console.log('🚨 [PHOTOGRAPHER DEBUG] Normal error:', normalError);
        
        // Emergency fallback like PhotoUpload component
        try {
          response = await fetch('/api/emergency/mobile-upload', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });
          
          console.log('🚨 [EMERGENCY] Emergency endpoint response:', response.status, response.ok);
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Emergency endpoint failed: ${response.status} - ${errorText}`);
          }
        } catch (emergencyError) {
          console.log('🚨 [EMERGENCY] BOTH ENDPOINTS FAILED!');
          console.log('🚨 [EMERGENCY] Emergency error:', emergencyError);
          throw new Error(`Both endpoints failed. Normal: ${normalError instanceof Error ? normalError.message : String(normalError)}. Emergency: ${emergencyError instanceof Error ? emergencyError.message : String(emergencyError)}`);
        }
      }

      const result = await response.json();

      if (response.ok) {
        setUploadResult({
          success: true,
          message: result.message || `Subida exitosa`,
          uploaded: result.uploaded || files.length,
          failed: result.failed || 0,
          filesCount: files.length,
          eventId: parseInt(selectedEventId),
          photos: result.photos || []
        });
        setFiles([]);
      } else {
        setError(result.message || 'Error al subir fotos');
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('401') || msg.includes('Authentication')) {
        setError('Sesión expirada. Por favor vuelve a iniciar sesión como fotógrafo.');
      } else if (msg.includes('403')) {
        setError('No tienes autorización para subir fotos a este evento. Contacta al administrador.');
      } else {
        setError('Error de conexión al subir fotos. Verifica tu conexión e intenta de nuevo.');
      }
    } finally {
      setUploading(false);
      setUploadProgress(100);
    }
  };

  const uploadFiles = async (forceDuplicates = false) => {
    if (files.length === 0) {
      setError('Selecciona al menos una foto para subir');
      return;
    }

    if (!selectedEventId) {
      setError('Selecciona un evento para subir las fotos');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setUploadResult(null);

    try {
      console.log(`📤 Iniciando subida inteligente de ${files.length} fotos en lotes...`);
      
      // Procesamiento inteligente con lotes adaptativos según dispositivo
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const BATCH_SIZE = isMobile ? 2 : 5; // Lotes de 2 fotos en móvil, 5 en desktop
      const batches = [];
      
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        batches.push(files.slice(i, i + BATCH_SIZE));
      }
      
      console.log(`📱 Dispositivo detectado: ${isMobile ? 'Móvil' : 'Desktop'}`);
      console.log(`📦 Usando lotes de ${BATCH_SIZE} fotos para optimizar la subida`);
      
      console.log(`📊 Dividiendo ${files.length} fotos en ${batches.length} lotes de ${BATCH_SIZE} fotos cada uno`);
      
      let totalUploaded = 0;
      let totalFailed = 0;
      let totalDuplicates = 0;
      let allPhotos: any[] = [];
      let allErrors: string[] = [];
      
      // Procesar cada lote secuencialmente
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchProgress = (batchIndex / batches.length) * 100;
        
        setCurrentBatch(`Procesando lote ${batchIndex + 1} de ${batches.length} (${batch.length} fotos)`);
        setUploadProgress(batchProgress);
        
        // Comprimir fotos en móviles antes de subir (si no está deshabilitado)
        let processedBatch = batch;
        if (isMobile && !skipCompression) {
          try {
            setCurrentBatch(`📱 Comprimiendo ${batch.length} fotos para móvil (lote ${batchIndex + 1}/${batches.length})...`);
            const totalSizeBefore = batch.reduce((sum, file) => sum + file.size, 0);
            
            processedBatch = await Promise.all(
              batch.map(async (file, index) => {
                setCurrentBatch(`📱 Comprimiendo foto ${index + 1}/${batch.length} del lote ${batchIndex + 1}/${batches.length}...`);
                return compressImageForMobile(file);
              })
            );
            
            const totalSizeAfter = processedBatch.reduce((sum, file) => sum + file.size, 0);
            const savedMB = (totalSizeBefore - totalSizeAfter) / 1024 / 1024;
            console.log(`📱 Compresión completada: ${savedMB.toFixed(1)}MB ahorrados en lote ${batchIndex + 1}`);
          } catch (compressionError) {
            console.error(`❌ Error en compresión del lote ${batchIndex + 1}, usando archivos originales:`, compressionError);
            setCurrentBatch(`⚠️ Error en compresión, usando archivos originales...`);
            processedBatch = batch;
          }
        } else if (isMobile && skipCompression) {
          console.log(`⚡ Omitiendo compresión móvil para lote ${batchIndex + 1} (modo rápido)`);
          setCurrentBatch(`⚡ Subiendo sin compresión (lote ${batchIndex + 1}/${batches.length})...`);
        }
        
        // VALIDACIÓN CRÍTICA: Verificar que el evento esté seleccionado
        if (!selectedEventId || selectedEventId === '') {
          console.error(`❌ CRÍTICO: No hay evento seleccionado para el lote ${batchIndex + 1}`);
          allErrors.push(`Lote ${batchIndex + 1}: Sin evento seleccionado`);
          totalFailed += batch.length;
          continue;
        }

        const formData = new FormData();
        
        processedBatch.forEach((file) => {
          formData.append('photos', file);
        });
        
        formData.append('eventId', selectedEventId);
        if (forceDuplicates) {
          formData.append('forceDuplicates', 'true');
        }

        console.log(`🎯 Lote ${batchIndex + 1}: Subiendo a evento ${selectedEventId} (${selectedEventName})`);
        console.log(`📊 Validación: Evento válido = ${!!selectedEventId}, ID = ${selectedEventId}`);
        
        
        const controller = new AbortController();
        // Timeout más agresivo para prevenir bloqueos
        const timeoutDuration = isMobile ? 60000 : 120000; // 1 min móvil, 2 min desktop
        const timeoutId = setTimeout(() => {
          console.log(`⏰ TIMEOUT: Abortando lote ${batchIndex + 1} después de ${timeoutDuration/1000}s`);
          controller.abort();
        }, timeoutDuration);
        
        try {
          console.log(`📱 Enviando lote ${batchIndex + 1}:`, {
            batchSize: batch.length,
            eventId: selectedEventId,
            fileNames: batch.map(f => f.name),
            fileSizes: batch.map(f => f.size),
            userAgent: navigator.userAgent
          });

          // 🔒 CRITICAL FIX: Use apiRequest for authentication
          const { apiRequest } = await import('@/lib/queryClient');
          
          console.log(`📱 Enviando con apiRequest lote ${batchIndex + 1}`);
          
          const response = await apiRequest('POST', '/api/photos/upload', formData);
          
          console.log(`📱 Respuesta lote ${batchIndex + 1}:`, {
            status: response.status,
            statusText: response.statusText
          });
          
          clearTimeout(timeoutId);

          const result = await response.json();
          
          totalUploaded += result.performance.successful || 0;
          totalFailed += result.performance.failed || 0;
          totalDuplicates += result.performance.duplicates || 0;
          
          if (result.photos) {
            allPhotos.push(...result.photos);
          }
          
          if (result.performance.errors) {
            allErrors.push(...result.performance.errors);
          }
          
          console.log(`✅ Lote ${batchIndex + 1} completado: ${result.performance.successful} exitosas, ${result.performance.failed} fallidas`);
          
          // Actualizar progreso específico para móviles
          setCurrentBatch(`✅ Lote ${batchIndex + 1}/${batches.length} completado - ${result.performance.successful} fotos subidas`);
          
          // Pausa de 2 segundos entre lotes para evitar sobrecarga
          if (batchIndex < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            setCurrentBatch(`📤 Procesando lote ${batchIndex + 2}/${batches.length}...`);
          }
          
        } catch (error) {
          clearTimeout(timeoutId);
          console.error(`❌ Error en lote ${batchIndex + 1}:`, error);
          const errMsg = error instanceof Error ? error.message : 'Error desconocido';
          if (errMsg.includes('401') || errMsg.includes('Authentication') || errMsg.includes('403')) {
            throw error;
          }
          allErrors.push(`Lote ${batchIndex + 1}: ${errMsg}`);
          totalFailed += batch.length;
        }
      }
      
      // Resultado final consolidado
      setUploadResult({
        success: true,
        message: `Subida por lotes completada: ${totalUploaded} exitosas, ${totalFailed} fallidas, ${totalDuplicates} duplicados`,
        uploaded: totalUploaded,
        failed: totalFailed,
        photos: allPhotos,
        errors: allErrors,
        filesCount: files.length,
        eventId: parseInt(selectedEventId),
      });
      
      setUploadProgress(100);
      setCurrentBatch(`🎉 ¡SUBIDA COMPLETADA! ${totalUploaded} de ${files.length} fotos subidas exitosamente a Google Cloud Storage`);
      
      // Limpiar archivos después de subida exitosa
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
      setFiles([]);

    } catch (error) {
      console.error('Upload error:', error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          setError('Timeout: El servidor tardó demasiado en responder. Se guardó el progreso para reanudar.');
        } else if (error.message.includes('401') || error.message.includes('Authentication')) {
          setError('Sesión expirada. Por favor vuelve a iniciar sesión como fotógrafo.');
        } else if (error.message.includes('403')) {
          setError('No tienes autorización para subir fotos a este evento. Contacta al administrador.');
        } else if (error.message.includes('413')) {
          setError('Error 413: Archivos demasiado grandes. Intenta subir fotos más pequeñas o reduce la cantidad.');
        } else {
          setError(error.message);
        }
      } else {
        setError('Error desconocido durante la subida');
      }
      
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const resumeUpload = async () => {
    if (!sessionId || files.length === 0) {
      setError('No hay sesión activa para reanudar');
      return;
    }

    if (!selectedEventId) {
      setError('Selecciona un evento para reanudar la subida');
      return;
    }

    setIsResuming(true);
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setUploadResult(null);

    try {
      console.log(`🔄 Reanudando subida con sesión: ${sessionId}`);
      
      const formData = new FormData();
      
      files.forEach((file) => {
        formData.append('photos', file);
      });
      
      formData.append('eventId', selectedEventId);
      formData.append('sessionId', sessionId);

      setCurrentBatch('Reanudando subida desde donde se quedó...');

      const response = await apiRequest('POST', '/api/photos/resume-upload', formData);

      const result = await response.json();
      
      setUploadResult({
        success: true,
        message: `Reanudación completada: ${result.performance.successful} subidas exitosas, ${result.performance.failed} fallidas, ${result.performance.duplicates} duplicados`,
        uploaded: result.performance.successful,
        failed: result.performance.failed,
        photos: result.photos || [],
        errors: result.performance.errors || [],
        filesCount: files.length,
        eventId: parseInt(selectedEventId),
      });
      
      setUploadProgress(100);
      setCurrentBatch(`Reanudación completada: ${result.performance.successful} fotos subidas exitosamente`);
      
      // Clear files after successful upload
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
      setFiles([]);
      setSessionId(null);

    } catch (error) {
      console.error('Resume error:', error);
      
      if (error instanceof Error) {
        const msg = error.message;
        if (error.name === 'AbortError') {
          setError('Timeout: El servidor tardó demasiado en responder durante la reanudación.');
        } else if (msg.includes('401') || msg.includes('Authentication')) {
          setError('Sesión expirada. Por favor vuelve a iniciar sesión como fotógrafo.');
        } else if (msg.includes('403')) {
          setError('No tienes autorización para subir fotos a este evento. Contacta al administrador.');
        } else {
          setError(msg);
        }
      } else {
        setError('Error desconocido durante la reanudación');
      }
      
      setUploadProgress(0);
    } finally {
      setUploading(false);
      setIsResuming(false);
    }
  };

  const clearAll = () => {
    files.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setFiles([]);
    setError(null);
    setUploadResult(null);
    setUploadProgress(0);
    setCurrentBatch('');
    setSessionId(null);
  };

  const selectFromGallery = () => {
    const input = document.createElement('input');
    input.type = 'file';
    // 📱 CRITICAL FIX: Add HEIC/HEIF support for iPhone photos
    input.accept = 'image/jpeg,image/jpg,image/png,image/tiff,image/gif,image/webp,image/bmp,image/heic,image/heif';
    input.multiple = true;
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files) {
        onDrop(Array.from(target.files));
      }
    };
    input.click();
  };

  const takePhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Usar cámara trasera
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files) {
        onDrop(Array.from(target.files));
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {userRole === 'photographer' ? (
        <PhotographerNavigation onLogout={onLogout} />
      ) : (
        <NavigationHeader onLogout={onLogout} />
      )}
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Upload className="text-primary h-6 w-6" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Carga Masiva de Fotos</h1>
            </div>
            <p className="text-gray-600">
              Selecciona un evento y sube las fotos para procesamiento automático con OCR
            </p>
          </div>

          {/* Event Selection */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Seleccionar Evento
              </CardTitle>
              <CardDescription>
                {userRole === 'photographer' 
                  ? 'Puedes subir fotos a cualquier evento disponible. Tu evento asignado por defecto aparece seleccionado.' 
                  : 'Elige el evento al cual pertenecen las fotos que vas a subir'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="event-select">Evento de destino</Label>
                {eventsLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-sm text-gray-600">Cargando eventos...</span>
                  </div>
                ) : (
                  <Select 
                    value={selectedEventId} 
                    onValueChange={setSelectedEventId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona un evento de destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEvents.map((event: any) => (
                        <SelectItem key={event.id} value={event.id.toString()}>
                          {event.name} - {new Date(event.date).toLocaleDateString('es-ES')}
                          {userRole === 'photographer' && currentUser?.assignedEventId === event.id && ' (Tu evento asignado)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              {selectedEventId && (
                <Alert className="mt-4 border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <strong>Evento seleccionado:</strong> {selectedEventName} (ID: {selectedEventId})
                    <br />
                    Las fotos se subirán a este evento y se procesarán automáticamente para detectar dorsales.
                  </AlertDescription>
                </Alert>
              )}
              
              {!selectedEventId && availableEvents.length > 0 && (
                <Alert className="mt-4 border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>⚠️ CRÍTICO:</strong> Debes seleccionar un evento antes de subir fotos.
                    <br />
                    Sin selección de evento, las fotos no se subirán correctamente.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Upload Area */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Seleccionar Fotos
              </CardTitle>
              <CardDescription>
                <span className="hidden md:inline">Arrastra y suelta las fotos aquí, o haz clic para seleccionar</span>
                <span className="md:hidden">Haz clic para seleccionar fotos desde tu galería</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors touch-manipulation ${
                  isDragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50 active:bg-primary/5'
                }`}
              >
                <input 
                  {...getInputProps()} 
                  accept="image/*,.jpg,.jpeg,.png,.tiff,.gif,.webp,.bmp,.heic,.heif"
                />
                <FileImage className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                {isDragActive ? (
                  <p className="text-lg">Suelta las fotos aquí...</p>
                ) : (
                  <>
                    <p className="text-lg mb-2">
                      <span className="hidden md:inline">Arrastra fotos aquí o haz clic para seleccionar</span>
                      <span className="md:hidden">Toca aquí para seleccionar fotos</span>
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Formatos soportados: JPG, PNG, TIFF (máx. 50MB por foto)
                    </p>
                    {/* Botones separados para galería y cámara en móvil */}
                    <div className="flex gap-3 justify-center md:hidden">
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm"
                        className="bg-primary/5 border-primary text-primary hover:bg-primary hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectFromGallery();
                        }}
                      >
                        📱 Galería
                      </Button>
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm"
                        className="bg-primary/5 border-primary text-primary hover:bg-primary hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          takePhoto();
                        }}
                      >
                        📷 Cámara
                      </Button>
                    </div>
                    {/* Botón tradicional para desktop */}
                    <Button 
                      type="button"
                      variant="outline" 
                      size="lg"
                      className="mt-4 bg-primary/5 border-primary text-primary hover:bg-primary hover:text-white hidden md:inline-flex"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectFromGallery();
                      }}
                    >
                      <FileImage className="h-5 w-5 mr-2" />
                      Seleccionar Archivos
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* File List */}
          {files.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Fotos Seleccionadas ({files.length})</CardTitle>
                  <Button variant="outline" size="sm" onClick={clearAll}>
                    <X className="h-4 w-4 mr-2" />
                    Limpiar Todo
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {files.map((file, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={file.preview}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <p className="text-xs text-center mt-1 truncate">
                        Foto seleccionada
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <span>{error}</span>
                {(error.includes('Sesión expirada') || error.includes('autenticación') || error.includes('401') || error.includes('autorización')) && (
                  <div className="mt-3">
                    <a
                      href="/photographer-login"
                      className="inline-flex items-center px-4 py-2 bg-white text-red-700 border border-red-300 rounded-md text-sm font-medium hover:bg-red-50 transition-colors"
                    >
                      Volver a iniciar sesión
                    </a>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Progress */}
          {uploading && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Subiendo fotos...</span>
                    <span className="text-sm text-muted-foreground">{uploadProgress.toFixed(0)}%</span>
                  </div>
                  {currentBatch && (
                    <p className="text-xs text-muted-foreground">{currentBatch}</p>
                  )}
                  <Progress value={uploadProgress} className="h-2" />
                  <div className="flex justify-center mt-3">
                    <Button
                      onClick={cancelUpload}
                      variant="destructive"
                      size="sm"
                      className="px-4"
                    >
                      ❌ Cancelar Subida
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success Result */}
          {uploadResult && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <div className="space-y-2">
                  <p><strong>🎉 ¡SUBIDA EXITOSA!</strong></p>
                  <p>{uploadResult.message}</p>
                  <p>✅ {uploadResult.uploaded} de {uploadResult.filesCount} fotos guardadas en Google Cloud Storage</p>
                  {uploadResult.failed && uploadResult.failed > 0 && (
                    <p className="text-red-600">⚠️ {uploadResult.failed} fotos fallaron</p>
                  )}
                  {uploadResult.photos && uploadResult.photos.filter && uploadResult.photos.filter(p => p.status === 'duplicate').length > 0 && (
                    <p className="text-yellow-600">🔄 {uploadResult.photos.filter(p => p.status === 'duplicate').length} fotos eran duplicados (ya existían)</p>
                  )}
                  <p className="text-sm">Las fotos están siendo procesadas automáticamente con OCR para detectar dorsales.</p>
                  <div className="mt-3 space-x-2">
                    <button 
                      onClick={() => window.location.reload()} 
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      🔄 Actualizar contador
                    </button>
                    <button 
                      onClick={async () => {
                        const response = await fetch(`/api/events/${selectedEventId}`);
                        const event = await response.json();
                        alert(`Fotos actuales en evento: ${event.photoCount}`);
                      }} 
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      📊 Verificar estadísticas
                    </button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}



          {/* Upload Button */}
          {files.length > 0 && (
            <div className="flex justify-center gap-4">
              <Button
                onClick={() => uploadFilesSimple(false)}
                disabled={files.length === 0 || uploading || !selectedEventId}
                size="lg"
                className="px-8 bg-green-600 hover:bg-green-700"
              >
                {uploading && !isResuming ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    ⚡ Subida Rápida ({files.length} {files.length === 1 ? 'foto' : 'fotos'})
                  </>
                )}
              </Button>

              <Button
                onClick={() => uploadFiles(false)}
                disabled={files.length === 0 || uploading || !selectedEventId}
                size="lg"
                variant="outline"
                className="px-8"
              >
                {uploading && !isResuming ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    📦 Subida por Lotes
                  </>
                )}
              </Button>

              {/* Resume Button */}
              {sessionId && (
                <Button
                  onClick={resumeUpload}
                  disabled={files.length === 0 || uploading || !selectedEventId}
                  size="lg"
                  variant="outline"
                  className="px-8"
                >
                  {uploading && isResuming ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                      Reanudando...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Reanudar Subida
                    </>
                  )}
                </Button>
              )}
              
              {/* Force Upload Button */}
              <Button
                onClick={() => uploadFiles(true)}
                disabled={files.length === 0 || uploading || !selectedEventId}
                size="lg"
                variant="outline"
                className="px-8 border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                title="Sube las fotos aunque ya existan versiones anteriores"
              >
                ⚡ Forzar Subida
              </Button>
            </div>
          )}

          {/* Mobile Compression Toggle */}
          {/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && files.length > 0 && (
            <div className="flex justify-center mt-4">
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={skipCompression}
                  onChange={(e) => setSkipCompression(e.target.checked)}
                  className="rounded"
                />
                <span className="text-gray-600">
                  ⚡ Subida rápida (omitir compresión móvil)
                </span>
              </label>
            </div>
          )}

          {/* Instructions */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Instrucciones de Uso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">1</div>
                  <div>
                    <p className="font-medium">Selecciona un evento</p>
                    <p className="text-sm text-muted-foreground">Elige el evento al cual pertenecen las fotos que vas a subir</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">2</div>
                  <div>
                    <p className="font-medium">Agrega las fotos del evento</p>
                    <p className="text-sm text-muted-foreground">Arrastra y suelta o selecciona las fotos de la carrera (máximo 200 fotos por lote)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center mt-0.5">3</div>
                  <div>
                    <p className="font-medium">Sube y procesa automáticamente</p>
                    <p className="text-sm text-muted-foreground">El sistema detectará automáticamente los dorsales en cada foto usando OCR avanzado</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}