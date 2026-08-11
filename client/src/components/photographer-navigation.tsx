import { Button } from '@/components/ui/button';
import { LogOut, Upload, Camera } from 'lucide-react';

interface PhotographerNavigationProps {
  onLogout: () => void;
}

export default function PhotographerNavigation({ onLogout }: PhotographerNavigationProps) {
  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Camera className="h-8 w-8 text-primary" />
              <span className="ml-2 text-xl font-bold text-gray-900">photoracepro.com</span>
            </div>
            <div className="ml-10">
              <span className="text-sm text-gray-600 bg-blue-100 px-3 py-1 rounded-full">
                Fotógrafo
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Upload className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-700">Subir Fotos</span>
            </div>
            <Button
              onClick={onLogout}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Cerrar Sesión</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}