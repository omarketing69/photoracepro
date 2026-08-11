import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Activity, Clock, Zap, HardDrive, RefreshCw, Trash2, BarChart, Server, Monitor, Upload } from 'lucide-react';
import NavigationHeader from '@/components/navigation-header';

interface PerformanceMetrics {
  averageUploadTime: number;
  averageOcrTime: number;
  averageThumbnailTime: number;
  successRate: number;
  memoryTrend: number[];
  totalPhotosProcessed: number;
  peakMemoryUsage: number;
  lastUpdated: string;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  lastCleanup: string;
}

interface AsyncStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  averageProcessingTime: number;
  lastProcessedAt?: string;
}

interface UploadMetrics {
  totalPhotos: number;
  processedPhotos: number;
  successfulPhotos: number;
  failedPhotos: number;
  averageOcrTime: number;
  totalUploadTime: number;
  lastProcessedPhoto: string;
  isActive: boolean;
}

export default function PerformanceDashboard({ onLogout }: { onLogout: () => void }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const { toast } = useToast();

  // Fetch performance metrics
  const { data: performanceData, refetch: refetchPerformance } = useQuery({
    queryKey: ['/api/admin/performance-stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/performance-stats');
      if (!response.ok) throw new Error('Error cargando métricas de rendimiento');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch cache statistics
  const { data: cacheData, refetch: refetchCache } = useQuery({
    queryKey: ['/api/admin/cache-stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/cache-stats');
      if (!response.ok) throw new Error('Error cargando estadísticas de cache');
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Fetch async processing stats
  const { data: asyncData, refetch: refetchAsync } = useQuery({
    queryKey: ['/api/admin/async-processing-stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/async-processing-stats');
      if (!response.ok) throw new Error('Error cargando estadísticas de procesamiento asíncrono');
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds for async stats
  });

  // Fetch upload metrics in real-time
  const { data: uploadData, refetch: refetchUpload } = useQuery({
    queryKey: ['/api/admin/upload-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/admin/upload-metrics');
      if (!response.ok) throw new Error('Error cargando métricas de upload');
      return response.json();
    },
    refetchInterval: 2000, // Refresh every 2 seconds for real-time updates
  });

  const performanceMetrics: PerformanceMetrics | null = performanceData?.data?.systemMetrics || null;
  const cacheStats: CacheStats | null = cacheData?.data?.cacheStats || null;
  const asyncStats: AsyncStats | null = asyncData?.data || null;
  const uploadMetrics: UploadMetrics | null = uploadData?.data || null;

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchPerformance(),
        refetchCache(),
        refetchAsync(),
        refetchUpload()
      ]);
      toast({
        title: 'Métricas actualizadas',
        description: 'Todas las métricas han sido actualizadas exitosamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error actualizando las métricas',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCleanupTemp = async () => {
    setIsCleaning(true);
    try {
      const response = await fetch('/api/admin/cleanup-temp', {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Error en limpieza');
      
      const result = await response.json();
      
      toast({
        title: 'Limpieza completada',
        description: `${result.data.cleanedFiles} archivos temporales eliminados`,
      });
      
      await refetchPerformance();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error durante la limpieza de archivos temporales',
        variant: 'destructive',
      });
    } finally {
      setIsCleaning(false);
    }
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
  };

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'bg-green-500';
    if (value >= thresholds.warning) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader onLogout={onLogout} />
      
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Panel de Rendimiento</h1>
            <p className="text-gray-600 mt-2">Monitoreo y optimización del sistema</p>
          </div>
          
          <div className="flex gap-4">
            <Button 
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              variant="outline"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            
            <Button 
              onClick={handleCleanupTemp}
              disabled={isCleaning}
              variant="outline"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpiar Temp
            </Button>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tiempo de Subida</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {performanceMetrics ? formatTime(performanceMetrics.averageUploadTime) : '--'}
              </div>
              <p className="text-xs text-muted-foreground">
                Promedio por foto
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tiempo de OCR</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {performanceMetrics ? formatTime(performanceMetrics.averageOcrTime) : '--'}
              </div>
              <p className="text-xs text-muted-foreground">
                Promedio por foto
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
              <BarChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {performanceMetrics ? `${performanceMetrics.successRate.toFixed(1)}%` : '--'}
              </div>
              <Progress 
                value={performanceMetrics?.successRate || 0} 
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memoria Pico</CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {performanceMetrics ? `${performanceMetrics.peakMemoryUsage}MB` : '--'}
              </div>
              <p className="text-xs text-muted-foreground">
                Uso máximo registrado
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Cache Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Estadísticas de Cache
              </CardTitle>
              <CardDescription>
                Rendimiento del sistema de cache de thumbnails
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Entradas totales</span>
                  <Badge variant="outline">{cacheStats?.totalEntries || 0}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Tamaño total</span>
                  <Badge variant="outline">{formatBytes(cacheStats?.totalSize || 0)}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Tasa de aciertos</span>
                  <Badge className={getStatusColor(cacheStats?.hitRate || 0, { good: 80, warning: 60 })}>
                    {cacheStats?.hitRate.toFixed(1)}%
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Expulsiones</span>
                  <Badge variant="outline">{cacheStats?.evictions || 0}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Async Processing Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Procesamiento Asíncrono
              </CardTitle>
              <CardDescription>
                Estado de la cola de procesamiento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Pendientes</span>
                  <Badge variant="outline">{asyncStats?.pending || 0}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Procesando</span>
                  <Badge variant={asyncStats?.processing ? 'default' : 'outline'}>
                    {asyncStats?.processing || 0}
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Completados</span>
                  <Badge variant="outline">{asyncStats?.completed || 0}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Fallidos</span>
                  <Badge variant={asyncStats?.failed ? 'destructive' : 'outline'}>
                    {asyncStats?.failed || 0}
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Tiempo promedio</span>
                  <Badge variant="outline">
                    {formatTime(asyncStats?.averageProcessingTime || 0)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Memory Trend */}
        {performanceMetrics?.memoryTrend && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Tendencia de Memoria
              </CardTitle>
              <CardDescription>
                Últimas 20 mediciones de uso de memoria
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end justify-between gap-1">
                {performanceMetrics.memoryTrend.map((value, index) => (
                  <div key={index} className="flex-1 flex flex-col justify-end">
                    <div 
                      className="bg-blue-500 rounded-t min-h-[4px]"
                      style={{ height: `${(value / Math.max(...performanceMetrics.memoryTrend)) * 100}%` }}
                      title={`${value}MB`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 text-sm text-gray-600">
                Rango: {Math.min(...performanceMetrics.memoryTrend)}MB - {Math.max(...performanceMetrics.memoryTrend)}MB
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Metrics - Real-time */}
        {uploadMetrics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Métricas de Upload en Tiempo Real
                {uploadMetrics.isActive && (
                  <Badge variant="secondary" className="animate-pulse">
                    Activo
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Monitoreo de uploads actuales y estadísticas de procesamiento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium">Total Fotos</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {uploadMetrics.totalPhotos}
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium">Procesadas</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {uploadMetrics.processedPhotos}
                  </div>
                </div>
                
                <div className="bg-emerald-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span className="text-sm font-medium">Exitosas</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {uploadMetrics.successfulPhotos}
                  </div>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm font-medium">Fallidas</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">
                    {uploadMetrics.failedPhotos}
                  </div>
                </div>
              </div>
              
              {uploadMetrics.totalPhotos > 0 && (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Progreso</span>
                      <span className="text-sm text-gray-600">
                        {((uploadMetrics.processedPhotos / uploadMetrics.totalPhotos) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(uploadMetrics.processedPhotos / uploadMetrics.totalPhotos) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Tiempo promedio OCR</div>
                      <div className="text-lg font-semibold">
                        {uploadMetrics.averageOcrTime > 0 ? `${uploadMetrics.averageOcrTime.toFixed(0)}ms` : 'N/A'}
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">Tiempo total upload</div>
                      <div className="text-lg font-semibold">
                        {uploadMetrics.totalUploadTime > 0 ? `${(uploadMetrics.totalUploadTime / 1000).toFixed(1)}s` : 'N/A'}
                      </div>
                    </div>
                  </div>
                  
                  {uploadMetrics.lastProcessedPhoto && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-sm text-blue-600 mb-1">Última foto procesada</div>
                      <div className="text-sm font-medium truncate">
                        {uploadMetrics.lastProcessedPhoto}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle>Estado del Sistema</CardTitle>
            <CardDescription>
              Información general del rendimiento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Alert>
                <Activity className="h-4 w-4" />
                <AlertDescription>
                  <strong>Fotos procesadas:</strong> {performanceMetrics?.totalPhotosProcessed || 0}
                </AlertDescription>
              </Alert>
              
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  <strong>Última actualización:</strong> {
                    performanceMetrics?.lastUpdated 
                      ? new Date(performanceMetrics.lastUpdated).toLocaleTimeString()
                      : 'Nunca'
                  }
                </AlertDescription>
              </Alert>
              
              <Alert>
                <Server className="h-4 w-4" />
                <AlertDescription>
                  <strong>Procesamiento activo:</strong> {asyncStats?.processing ? 'Sí' : 'No'}
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}