import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import NavigationHeader from '@/components/navigation-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Camera, 
  Users, 
  Image, 
  TrendingUp, 
  Clock, 
  Target, 
  BarChart3, 
  Activity,
  CheckCircle,
  AlertCircle,
  Zap,
  ShoppingCart,
  DollarSign,
  FileText
} from 'lucide-react';

interface AnalyticsData {
  totalPhotos: number;
  processedPhotos: number;
  totalDorsals: number;
  uniqueDorsals: number;
  processingRate: number;
  averageDorsalsPerPhoto: number;
  topDorsals: Array<{ dorsal: number; count: number }>;
  recentActivity: Array<{
    id: number;
    action: string;
    timestamp: string;
    details: string;
  }>;
  processingStats: {
    successful: number;
    failed: number;
    pending: number;
  };
  salesStats?: {
    totalSales: number;
    totalRevenue: number;
    averageSaleAmount: number;
    salesByEvent: Array<{
      eventId: number;
      totalSales: number;
      totalRevenue: number;
    }>;
  };
}

export default function AnalyticsPage({ onLogout }: { onLogout: () => void }) {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedEventId, setSelectedEventId] = useState<string>('all');

  // Obtener lista de eventos para el selector
  const { data: events } = useQuery({
    queryKey: ['/api/events'],
  });

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['/api/analytics', timeRange, selectedEventId],
    queryFn: async () => {
      const params = new URLSearchParams({
        range: timeRange,
        ...(selectedEventId !== 'all' && { eventId: selectedEventId })
      });
      const response = await fetch(`/api/analytics?${params}`);
      if (!response.ok) {
        throw new Error('Error cargando estadísticas');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-ES').format(num);
  };

  const generatePDFReport = () => {
    const eventId = selectedEventId === 'all' ? '1' : selectedEventId;
    const url = `/api/analytics/report/${eventId}?range=${timeRange}`;
    window.open(url, '_blank');
  };

  const formatPercentage = (value: number, total: number) => {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationHeader onLogout={onLogout} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-gray-600">Cargando estadísticas...</span>
          </div>
        </div>
      </div>
    );
  }

  const successRate = analytics ? formatPercentage(analytics.processingStats.successful, analytics.totalPhotos) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader onLogout={onLogout} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Estadísticas y Análisis</h1>
              <p className="text-gray-600 mt-2">
                {selectedEventId === 'all' 
                  ? 'Métricas de todos los eventos en la plataforma'
                  : `Métricas del evento: ${events?.find((e: any) => e.id.toString() === selectedEventId)?.name || 'Evento seleccionado'}`
                }
              </p>
            </div>
          </div>
          
          {/* Filtros */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Evento:</span>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Seleccionar evento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los eventos</SelectItem>
                  {events?.map((event: any) => (
                    <SelectItem key={event.id} value={event.id.toString()}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button 
                variant={timeRange === '24h' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setTimeRange('24h')}
              >
                24h
              </Button>
              <Button 
                variant={timeRange === '7d' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setTimeRange('7d')}
              >
                7 días
              </Button>
              <Button 
                variant={timeRange === '30d' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setTimeRange('30d')}
              >
                30 días
              </Button>
            </div>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Fotos</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {analytics ? formatNumber(analytics.totalPhotos) : '0'}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Camera className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Dorsales Detectados</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {analytics ? formatNumber(analytics.totalDorsals) : '0'}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <Target className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Dorsales Únicos</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {analytics ? formatNumber(analytics.uniqueDorsals) : '0'}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tasa de Éxito</p>
                  <p className="text-2xl font-bold text-gray-900">{successRate}%</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-full">
                  <TrendingUp className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sales Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Ventas</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {analytics?.salesStats ? formatNumber(analytics.salesStats.totalSales) : '0'}
                  </p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-full">
                  <ShoppingCart className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${analytics?.salesStats ? formatNumber(analytics.salesStats.totalRevenue) : '0'} COP
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Venta Promedio</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${analytics?.salesStats ? formatNumber(Math.round(analytics.salesStats.averageSaleAmount)) : '0'} COP
                  </p>
                </div>
                <div className="p-3 bg-indigo-100 rounded-full">
                  <TrendingUp className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Generar Reporte</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => generatePDFReport()}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                </div>
                <div className="p-3 bg-pink-100 rounded-full">
                  <FileText className="h-6 w-6 text-pink-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Processing Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Estado del Procesamiento
              </CardTitle>
              <CardDescription>
                Distribución del estado de las fotos procesadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Exitosas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {formatNumber(analytics.processingStats.successful)}
                      </span>
                      <Badge variant="secondary">
                        {formatPercentage(analytics.processingStats.successful, analytics.totalPhotos)}%
                      </Badge>
                    </div>
                  </div>
                  <Progress 
                    value={formatPercentage(analytics.processingStats.successful, analytics.totalPhotos)} 
                    className="h-2"
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium">Fallidas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {formatNumber(analytics.processingStats.failed)}
                      </span>
                      <Badge variant="destructive">
                        {formatPercentage(analytics.processingStats.failed, analytics.totalPhotos)}%
                      </Badge>
                    </div>
                  </div>
                  <Progress 
                    value={formatPercentage(analytics.processingStats.failed, analytics.totalPhotos)} 
                    className="h-2"
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium">Pendientes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {formatNumber(analytics.processingStats.pending)}
                      </span>
                      <Badge variant="outline">
                        {formatPercentage(analytics.processingStats.pending, analytics.totalPhotos)}%
                      </Badge>
                    </div>
                  </div>
                  <Progress 
                    value={formatPercentage(analytics.processingStats.pending, analytics.totalPhotos)} 
                    className="h-2"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Rendimiento OCR
              </CardTitle>
              <CardDescription>
                Métricas de detección de dorsales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">
                    {analytics ? analytics.averageDorsalsPerPhoto.toFixed(1) : '0.0'}
                  </div>
                  <p className="text-sm text-gray-600">Dorsales promedio por foto</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-xl font-semibold text-gray-900">
                      {analytics ? formatNumber(analytics.totalDorsals) : '0'}
                    </div>
                    <p className="text-xs text-gray-600">Total Detectados</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-xl font-semibold text-gray-900">
                      {analytics ? formatNumber(analytics.uniqueDorsals) : '0'}
                    </div>
                    <p className="text-xs text-gray-600">Únicos</p>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">Tasa de Procesamiento</p>
                  <div className="flex items-center justify-center">
                    <Activity className="h-4 w-4 text-green-600 mr-2" />
                    <span className="text-lg font-semibold text-green-600">
                      {analytics ? analytics.processingRate.toFixed(1) : '0.0'} fotos/min
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Dorsals */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Dorsales Más Fotografiados
            </CardTitle>
            <CardDescription>
              Los dorsales que aparecen en más fotos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analytics && analytics.topDorsals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analytics.topDorsals.slice(0, 6).map((item, index) => (
                  <div 
                    key={item.dorsal} 
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">Dorsal {item.dorsal}</p>
                        <p className="text-sm text-gray-600">{item.count} fotos</p>
                      </div>
                    </div>
                    <Badge variant="outline">{item.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No hay datos de dorsales disponibles
              </p>
            )}
          </CardContent>
        </Card>

        {/* Event Comparison - Only show when viewing all events */}
        {selectedEventId === 'all' && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Comparativa entre Eventos
              </CardTitle>
              <CardDescription>
                Rendimiento y estadísticas por evento individual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {events?.map((event: any) => (
                  <div key={event.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{event.name}</h4>
                        <p className="text-sm text-gray-600">{event.location} • {new Date(event.date).toLocaleDateString()}</p>
                      </div>
                      <Badge variant={event.status === 'active' ? 'default' : 'secondary'}>
                        {event.status === 'active' ? 'Activo' : event.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Fotos</p>
                        <p className="font-semibold">{event.totalPhotos || 0}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Participantes</p>
                        <p className="font-semibold">{event.expectedParticipants || 0}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Ventas</p>
                        <p className="font-semibold">{event.totalSales || 0}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Ingresos</p>
                        <p className="font-semibold">${formatNumber(event.totalRevenue || 0)} COP</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Sistema</CardTitle>
            <CardDescription>
              Detalles técnicos del procesamiento OCR
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Motor OCR</h4>
                <p className="text-sm text-gray-600">Google Vision API</p>
                <p className="text-xs text-gray-500">Precisión: 95%+</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Formatos Soportados</h4>
                <p className="text-sm text-gray-600">JPG, PNG, TIFF</p>
                <p className="text-xs text-gray-500">Máx. 50MB por archivo</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Capacidad</h4>
                <p className="text-sm text-gray-600">100 fotos por lote</p>
                <p className="text-xs text-gray-500">Procesamiento en tiempo real</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}