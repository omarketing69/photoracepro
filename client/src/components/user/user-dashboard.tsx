import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Hash, Search, Download, Eye, Star, Calendar, MapPin, Users } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { EventWithStats, SearchResult } from "@shared/schema";

interface UserDashboardProps {
  user: { id: number; email: string; role: string; name?: string };
  onLogout: () => void;
}

export default function UserDashboard({ user, onLogout }: UserDashboardProps) {
  const [searchDorsal, setSearchDorsal] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<number[]>([]);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: events } = useQuery<EventWithStats[]>({
    queryKey: ["/api/events"],
  });

  const { data: freeEvents } = useQuery<EventWithStats[]>({
    queryKey: ["/api/free-events"],
  });

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

  const handleSearch = async () => {
    if (!selectedEvent || !searchDorsal) {
      toast({
        title: "Datos incompletos",
        description: "Selecciona un evento e ingresa tu número de dorsal.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiRequest(
        "GET",
        `/api/photos/search?eventId=${selectedEvent}&dorsalNumber=${searchDorsal}`
      );
      const result = await response.json();
      setSearchResults(result);
      
      if (result.totalFound === 0) {
        toast({
          title: "Sin resultados",
          description: "No se encontraron fotos para este dorsal.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "¡Fotos encontradas!",
          description: `Se encontraron ${result.totalFound} fotos tuyas.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo realizar la búsqueda.",
        variant: "destructive",
      });
    }
  };

  const togglePhotoSelection = (photoId: number) => {
    setSelectedPhotos(prev =>
      prev.includes(photoId)
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId]
    );
  };

  const selectAllPhotos = () => {
    if (!searchResults) return;
    setSelectedPhotos(searchResults.photos.map(photo => photo.id));
  };

  const calculateTotal = () => {
    const photoPrice = settings?.photoPrice || 10000; // Use configured price or fallback
    return selectedPhotos.length * photoPrice;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <Search className="text-green-600 h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Portal de Participantes</h1>
                <p className="text-sm text-gray-600">Encuentra y descarga tus fotos de carrera</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm">
                <p className="text-gray-600">Bienvenido,</p>
                <p className="font-medium text-gray-900">{user.name || user.email}</p>
              </div>
              <Button variant="outline" onClick={onLogout}>
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            ¡Encuentra Tus Fotos de Carrera!
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Usa tu número de dorsal para encontrar todas las fotos donde apareces. 
            Nuestro sistema de reconocimiento automático las tiene organizadas para ti.
          </p>
        </div>

        {/* Search Section */}
        <Card className="mb-8 border border-gray-200 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50">
            <div className="flex items-center space-x-3">
              <Hash className="text-green-600 h-6 w-6" />
              <h3 className="text-lg font-semibold text-gray-900">Buscar por Número de Dorsal</h3>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <Label htmlFor="event">Evento</Label>
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tu evento" />
                  </SelectTrigger>
                  <SelectContent>
                    {events?.map((event) => (
                      <SelectItem key={event.id} value={event.id.toString()}>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>{event.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="dorsal">Tu Número de Dorsal</Label>
                <Input
                  id="dorsal"
                  type="number"
                  placeholder="Ej: 1234"
                  value={searchDorsal}
                  onChange={(e) => setSearchDorsal(e.target.value)}
                  className="text-lg text-center font-bold"
                />
              </div>
              
              <div className="flex items-end">
                <Button
                  onClick={handleSearch}
                  className="w-full bg-green-600 text-white hover:bg-green-700"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Buscar Mis Fotos
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Free Photos Section */}
        {freeEvents && freeEvents.length > 0 && (
          <Card className="mb-8 border border-green-200 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
              <div className="flex items-center space-x-3">
                <Star className="text-green-600 h-6 w-6" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Fotos Gratuitas Disponibles</h3>
                  <p className="text-sm text-gray-600">Explora fotos de eventos pasados sin costo</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {freeEvents.map((event) => (
                  <div
                    key={event.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">{event.name}</h4>
                        <div className="flex items-center text-sm text-gray-600 mt-1">
                          <Calendar className="mr-1 h-3 w-3" />
                          {new Date(event.date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="mr-1 h-3 w-3" />
                          {event.location}
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        Gratis
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="mr-1 h-3 w-3" />
                        {event.photoCount} fotos
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          console.log('Navegando a fotos gratuitas...');
                          window.location.href = '/free-photos';
                        }}
                        className="border-green-200 text-green-700 hover:bg-green-50"
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Ver Fotos
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    console.log('Navegando a fotos gratuitas desde botón principal...');
                    window.location.href = '/free-photos';
                  }}
                  className="border-green-200 text-green-700 hover:bg-green-50"
                >
                  Ver Todos los Eventos con Fotos Gratuitas
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Results */}
        {searchResults && searchResults.totalFound > 0 && (
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Tus Fotos</h3>
                <div className="flex items-center space-x-2">
                  <Badge className="bg-green-100 text-green-800">
                    Dorsal #{searchResults.dorsalNumber}
                  </Badge>
                  <Badge variant="outline">
                    {searchResults.totalFound} fotos encontradas
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              {/* Photo Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                {searchResults.photos.slice(0, 12).map((photo) => (
                  <div
                    key={photo.id}
                    className={`relative group cursor-pointer border-2 rounded-lg transition-colors ${
                      selectedPhotos.includes(photo.id)
                        ? "border-green-500 bg-green-50"
                        : "border-transparent hover:border-gray-300"
                    }`}
                    onClick={() => togglePhotoSelection(photo.id)}
                  >
                    <img
                      src={`/api/thumbnails/${photo.filename}`}
                      alt="Foto del evento"
                      className="w-full h-32 object-cover rounded-lg"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="w-full h-32 bg-gray-200 rounded-lg flex items-center justify-center" style={{display: 'none'}}>
                      <div className="text-center">
                        <Eye className="mx-auto h-6 w-6 text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500">Sin imagen</span>
                      </div>
                    </div>
                    
                    {selectedPhotos.includes(photo.id) && (
                      <div className="absolute inset-0 bg-green-500 bg-opacity-20 rounded-lg flex items-center justify-center">
                        <div className="bg-green-500 text-white rounded-full p-1">
                          <Star className="h-4 w-4" />
                        </div>
                      </div>
                    )}
                    
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                      #{searchResults.dorsalNumber}
                    </div>
                  </div>
                ))}
                
                {searchResults.totalFound > 12 && (
                  <div className="flex items-center justify-center bg-gray-100 rounded-lg h-32 text-gray-500">
                    <div className="text-center">
                      <span className="text-xl">+</span>
                      <p className="text-xs">{searchResults.totalFound - 12} más</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Purchase Section */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <Button
                      variant="outline"
                      onClick={selectAllPhotos}
                      disabled={selectedPhotos.length === searchResults.photos.length}
                    >
                      Seleccionar Todas ({searchResults.totalFound})
                    </Button>
                    <span className="text-sm text-gray-600">
                      <span className="font-medium text-green-600">{selectedPhotos.length}</span> fotos seleccionadas
                    </span>
                  </div>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">¿Listo para descargar?</h4>
                      <p className="text-sm text-gray-600">
                        Precio por foto: $COP {(settings?.photoPrice || 10000).toLocaleString('es-CO')} • Descarga inmediata en alta resolución
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">$COP {calculateTotal().toLocaleString('es-CO')}</p>
                      <Button
                        disabled={selectedPhotos.length === 0}
                        className="bg-green-600 text-white hover:bg-green-700 mt-2"
                        onClick={() => {
                          localStorage.setItem('selectedPhotoIds', JSON.stringify(selectedPhotos));
                          localStorage.setItem('eventId', selectedEvent);
                          localStorage.setItem('dorsalNumber', searchDorsal);
                          localStorage.setItem('userInfo', JSON.stringify({ 
                            email: user.email, 
                            name: user.name || user.email 
                          }));
                          setLocation('/photo-purchase');
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Comprar y Descargar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Card className="mt-8 border border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <h4 className="font-medium text-gray-900 mb-3">¿Necesitas ayuda?</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <p className="font-medium text-gray-900 mb-1">¿No encuentras tu dorsal?</p>
                <p>Asegúrate de seleccionar el evento correcto y verifica que tu número de dorsal sea el correcto.</p>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">¿Problemas con la compra?</p>
                <p>Contacta con el organizador del evento para obtener asistencia técnica.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}