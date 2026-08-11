import NavigationHeader from "@/components/navigation-header";
import EventManagement from "@/components/event-management";

interface EventsProps {
  onLogout?: () => void;
}

export default function Events({ onLogout }: EventsProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader onLogout={onLogout} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Eventos</h1>
          <p className="text-gray-600 mt-2">Administra todos tus eventos de carreras atléticas</p>
        </div>

        <EventManagement />
      </div>
    </div>
  );
}
