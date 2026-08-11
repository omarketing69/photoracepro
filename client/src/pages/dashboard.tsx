import NavigationHeader from "@/components/navigation-header";
import DashboardOverview from "@/components/dashboard-overview";
import EventManagement from "@/components/event-management";
import ProcessingStatus from "@/components/processing-status";
import ParticipantSearch from "@/components/participant-search";
import AnalyticsDashboard from "@/components/analytics-dashboard";
import { Camera } from "lucide-react";

interface DashboardProps {
  onLogout?: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  console.log("Dashboard component rendered with onLogout:", typeof onLogout);
  
  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader onLogout={onLogout} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Overview - Full Width */}
        <DashboardOverview />
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <EventManagement />
            <ProcessingStatus />
          </div>
          
          <div className="space-y-6">
            <ParticipantSearch />
            <AnalyticsDashboard />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Camera className="text-primary text-xl" />
                <h3 className="font-bold text-gray-900">photoracepro.com</h3>
              </div>
              <p className="text-gray-600 text-sm">
                Plataforma automatizada para la gestión de fotografías en eventos deportivos usando OCR y reconocimiento facial.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Características</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>Reconocimiento automático de dorsales</li>
                <li>Detección facial avanzada</li>
                <li>Organización automática</li>
                <li>Sistema de ventas integrado</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Tecnología</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>OCR con Google Vision Cloud</li>
                <li>OpenCV para procesamiento</li>
                <li>React + Tailwind CSS</li>
                <li>API REST con Flask</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Soporte</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>Documentación técnica</li>
                <li>Guías de implementación</li>
                <li>Precisión OCR 85-95%</li>
                <li>Procesamiento en lotes</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 mt-8 pt-8 text-center">
            <p className="text-gray-600 text-sm">
              © 2024 photoracepro.com. Solución completa para fotografía deportiva automatizada.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
