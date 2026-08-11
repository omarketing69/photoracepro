import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Hash, Smile, Eye, ShoppingCart, CheckSquare } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { EventWithStats, SearchResult } from "@shared/schema";

interface ParticipantSearchProps {
  isAdmin?: boolean;
}

export default function ParticipantSearch({ isAdmin = false }: ParticipantSearchProps) {
  const [searchDorsal, setSearchDorsal] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [selectedPhotos, setSelectedPhotos] = useState<number[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: events } = useQuery<EventWithStats[]>({
    queryKey: ["/api/events"],
  });

  const searchMutation = useMutation({
    mutationFn: async ({ eventId, dorsalNumber }: { eventId: number; dorsalNumber: number }) => {
      const response = await apiRequest(
        "GET",
        `/api/photos/search?eventId=${eventId}&dorsalNumber=${dorsalNumber}`
      );
      return response.json();
    },
    onSuccess: (data: SearchResult) => {
      setSearchResults(data);
      if (data.totalFound === 0) {
        toast({
          title: "Sin resultados",
          description: "No se encontraron fotos para este dorsal.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Búsqueda exitosa",
          description: `Se encontraron ${data.totalFound} fotos.`,
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo realizar la búsqueda.",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (!selectedEvent || !searchDorsal) {
      toast({
        title: "Datos incompletos",
        description: "Selecciona un evento e ingresa un número de dorsal.",
        variant: "destructive",
      });
      return;
    }

    searchMutation.mutate({
      eventId: parseInt(selectedEvent),
      dorsalNumber: parseInt(searchDorsal),
    });
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
    return selectedPhotos.length * 10000; // 10,000 COP per photo
  };

  return (
    <Card className="border border-gray-200">
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {isAdmin ? "Búsqueda de Fotos - Panel Administrativo" : "Portal de Búsqueda para Participantes"}
            </h3>
            <p className="text-gray-600 text-sm mt-1">
              {isAdmin 
                ? "Interface administrativa para visualizar y gestionar fotos" 
                : "Interface pública para que los corredores encuentren sus fotos"
              }
            </p>
          </div>
          <Badge variant="outline" className={isAdmin ? "bg-red-50 text-red-700" : "bg-blue-50 text-primary"}>
            {isAdmin ? "Administrador" : "Participante"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Search Form */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="event">Evento</Label>
              <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un evento" />
                </SelectTrigger>
                <SelectContent>
                  {events?.map((event) => (
                    <SelectItem key={event.id} value={event.id.toString()}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dorsal">Número de Dorsal</Label>
              <Input
                id="dorsal"
                type="number"
                placeholder="1234"
                value={searchDorsal}
                onChange={(e) => setSearchDorsal(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleSearch}
                disabled={searchMutation.isPending}
                className="w-full bg-primary text-white hover:bg-primary/90"
              >
                <Hash className="mr-2 h-4 w-4" />
                {searchMutation.isPending ? "Buscando..." : "Buscar"}
              </Button>
            </div>
          </div>

          {/* Search Results */}
          {searchResults && searchResults.totalFound > 0 && (
            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Resultados de Búsqueda</h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <span>Dorsal #{searchResults.dorsalNumber} - </span>
                    <span className="font-medium text-green-600">{searchResults.totalFound} fotos encontradas</span>
                  </div>
                </div>

                {/* Photo Gallery Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                  {searchResults.photos.slice(0, 12).map((photo) => (
                    <div
                      key={photo.id}
                      className={`relative group cursor-pointer border-2 rounded-lg transition-colors ${
                        !isAdmin && selectedPhotos.includes(photo.id)
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:border-gray-300"
                      }`}
                      onClick={() => !isAdmin && togglePhotoSelection(photo.id)}
                    >
                      <div className="w-full h-24 bg-gray-200 rounded-lg overflow-hidden">
                        {photo.thumbnailPath ? (
                          <img 
                            src={`/api/thumbnails/${photo.filename}`}
                            alt="Foto del evento"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to original image if thumbnail fails
                              e.currentTarget.src = `/api/images/${photo.filename}`;
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-gray-500 text-xs">Sin imagen</span>
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 rounded-lg transition-opacity flex items-center justify-center">
                        <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5" />
                      </div>
                      <div className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded">
                        #{searchResults.dorsalNumber}
                      </div>
                      {!isAdmin && selectedPhotos.includes(photo.id) && (
                        <div className="absolute top-2 left-2 bg-primary text-white rounded-full p-1">
                          <CheckSquare className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {searchResults.totalFound > 12 && (
                    <div className="flex items-center justify-center bg-gray-100 rounded-lg h-24 text-gray-500">
                      <div className="text-center">
                        <span className="text-xl">+</span>
                        <p className="text-xs">{searchResults.totalFound - 12} más</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Purchase Options for Participants */}
                {!isAdmin && (
                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Button
                          variant="outline"
                          onClick={selectAllPhotos}
                          disabled={selectedPhotos.length === searchResults.photos.length}
                        >
                          <CheckSquare className="mr-2 h-4 w-4" />
                          Seleccionar Todas ({searchResults.totalFound})
                        </Button>
                        <span className="text-sm text-gray-600">
                          <span className="font-medium text-primary">{selectedPhotos.length}</span> fotos seleccionadas
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Total</p>
                          <p className="text-lg font-bold text-gray-900">$COP {calculateTotal().toLocaleString('es-CO')}</p>
                        </div>
                        <Button
                          disabled={selectedPhotos.length === 0}
                          className="bg-green-600 text-white hover:bg-green-700"
                          onClick={() => {
                            // Store selected photos and navigate to purchase page
                            localStorage.setItem('selectedPhotoIds', JSON.stringify(selectedPhotos));
                            localStorage.setItem('eventId', selectedEvent);
                            setLocation('/photo-purchase');
                          }}
                        >
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          Comprar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Admin Information */}
                {isAdmin && (
                  <div className="border-t border-gray-200 pt-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <strong>Modo Administrador:</strong> Visualizando fotos encontradas. Como administrador, tienes acceso completo a todas las fotos sin necesidad de compra.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </CardContent>
    </Card>
  );
}