import { useQuery } from "@tanstack/react-query";
import { Calendar, Images, Search, DollarSign, TrendingUp, CheckCircle, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function DashboardOverview() {
  const { data: stats, error, isError } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isError) {
    console.error("Dashboard stats query error:", error);
    // Return a fallback UI instead of crashing
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Resumen del Sistema</h2>
        <div className="text-red-500">Error cargando estadísticas del dashboard</div>
      </div>
    );
  }

  const statsCards = [
    {
      title: "Eventos Activos",
      value: stats?.activeEvents || 0,
      icon: Calendar,
      change: "+2 este mes",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Fotos Procesadas",
      value: stats?.processedPhotos || 0,
      icon: Images,
      change: "+1,234 hoy",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Dorsales Detectados",
      value: stats?.detectedDorsals || 0,
      icon: Search,
      change: "87% precisión OCR",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Ventas del Mes",
      value: stats?.monthlySales || "$0 COP",
      icon: DollarSign,
      change: "+15% vs mes anterior",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard General</h2>
          <p className="text-base text-gray-600 mt-1">Gestión completa de eventos y fotografías</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-green-50 text-green-600 px-3 py-2 rounded-lg">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Sistema OCR Activo</span>
          </div>
          <Link href="/performance-dashboard">
            <Button variant="outline" size="sm" className="flex items-center space-x-2">
              <Zap className="h-4 w-4" />
              <span>Rendimiento</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <Card key={index} className="border border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  </div>
                  <div className={`${stat.bgColor} p-3 rounded-lg flex-shrink-0`}>
                    <IconComponent className={`${stat.color} h-6 w-6`} />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-green-600 text-sm">
                  <TrendingUp className="mr-1 h-4 w-4" />
                  <span>{stat.change}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
