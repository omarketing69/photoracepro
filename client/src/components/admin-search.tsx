import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Hash, Eye } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { EventWithStats, SearchResult } from "@shared/schema";

export default function AdminSearch() {
  const [searchDorsal, setSearchDorsal] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const { toast } = useToast();

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

  return (
    <Card className="border border-gray-200">
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Búsqueda de Fotos - Panel Administrativo</h3>
            <p className="text-gray-600 text-sm mt-1">Interface administrativa para visualizar y gestionar fotos</p>
          </div>
          <Badge variant="outline" className="bg-red-50 text-red-700">
            Administrador
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
                      className="relative group border-2 border-transparent hover:border-gray-300 rounded-lg transition-colors"
                    >
                      <div className="w-full h-24 bg-gray-200 rounded-lg overflow-hidden">
                        {photo.thumbnailPath ? (
                          <img 
                            src={`/api/thumbnails/${photo.filename}`}
                            alt={`Foto ${photo.filename}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = `/api/images/${photo.filename}`;
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-gray-500 text-xs">{photo.filename}</span>
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 rounded-lg transition-opacity flex items-center justify-center">
                        <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5" />
                      </div>
                      <div className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded">
                        #{searchResults.dorsalNumber}
                      </div>
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

                {/* Admin Information */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>Modo Administrador:</strong> Visualizando fotos encontradas. Como administrador, tienes acceso completo a todas las fotos sin necesidad de compra.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </CardContent>
    </Card>
  );
}