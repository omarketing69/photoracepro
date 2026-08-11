import { useQuery } from "@tanstack/react-query";
import { Check, Upload, UserPlus, Euro, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { EventWithStats, ProcessingStats } from "@shared/schema";

export default function AnalyticsDashboard() {
  const { data: events } = useQuery<EventWithStats[]>({
    queryKey: ["/api/events"],
  });

  const eventsWithStats = events?.filter(event => event.processingStats) || [];

  const activityItems = [
    {
      icon: Check,
      title: "Procesamiento completado",
      description: 'Evento "10K Ciudad de Madrid" - 432 fotos organizadas',
      time: "Hace 2 horas",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      icon: Upload,
      title: "Nuevas fotos subidas",
      description: '156 archivos agregados al evento "Maratón Valencia"',
      time: "Hace 4 horas",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: UserPlus,
      title: "Nuevo evento creado",
      description: '"Trail Running Montaña" programado para el 28 Dic',
      time: "Hace 1 día",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      icon: Euro,
      title: "Venta realizada",
      description: "Participante #1247 compró 8 fotos (€24.00)",
      time: "Hace 2 días",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* OCR Performance by Event */}
      <Card className="border border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Rendimiento OCR por Evento</h3>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            {eventsWithStats.map((event) => {
              const stats = event.processingStats;
              const accuracy = parseFloat(stats?.ocrAccuracy || "0");
              
              return (
                <div key={event.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{event.name}</p>
                      <p className="text-sm text-gray-600">{stats?.totalPhotos || 0} fotos procesadas</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${accuracy >= 85 ? "text-green-500" : accuracy >= 70 ? "text-orange-500" : "text-red-500"}`}>
                        {accuracy}%
                      </p>
                      <p className="text-xs text-gray-600">precisión</p>
                    </div>
                  </div>
                  <Progress value={accuracy} className="h-2" />
                </div>
              );
            })}
            
            {eventsWithStats.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <TrendingUp className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No hay estadísticas de procesamiento disponibles</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Activity */}
      <Card className="border border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Actividad del Sistema</h3>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {activityItems.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <div key={index} className="flex items-start space-x-3">
                  <div className={`${item.bgColor} p-2 rounded-lg`}>
                    <IconComponent className={`${item.color} h-4 w-4`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-600">{item.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{item.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
