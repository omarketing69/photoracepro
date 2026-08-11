import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import NavigationHeader from "@/components/navigation-header";
import { Download, QrCode, Copy, CheckCircle, MessageCircle, Clock, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { EventWithStats } from "@shared/schema";

interface AdminDownloadCodesProps {
  onLogout: () => void;
}

interface GenerateCodeResponse {
  code: string;
  eventId: number;
  dorsalNumber: number;
  expiresAt: string;
  maxDownloads: number;
  eventName: string;
}

export default function AdminDownloadCodes({ onLogout }: AdminDownloadCodesProps) {
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [dorsalNumber, setDorsalNumber] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [maxDownloads, setMaxDownloads] = useState("5");
  const [generatedCode, setGeneratedCode] = useState<GenerateCodeResponse | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const { toast } = useToast();

  // Fetch only paid events (freePhotosEnabled = false)
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["/api/events"],
    select: (events: EventWithStats[]) => 
      events.filter(event => !event.freePhotosEnabled && event.status === 'active')
  });

  const generateCodeMutation = useMutation({
    mutationFn: async (data: {
      eventId: number;
      dorsalNumber: number;
      expiresInDays?: number;
      maxDownloads?: number;
    }): Promise<GenerateCodeResponse> => {
      const response = await apiRequest("POST", "/api/admin/generate-download-code", data);
      return response.json();
    },
    onSuccess: (response: GenerateCodeResponse) => {
      setGeneratedCode(response);
      toast({
        title: "✅ Código generado exitosamente",
        description: `Código ${response.code} creado para dorsal ${response.dorsalNumber}`,
      });
      // Clear form
      setDorsalNumber("");
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error al generar código",
        description: error.message || "No se pudo generar el código de descarga",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedEventId || !dorsalNumber) {
      toast({
        title: "Campos requeridos",
        description: "Por favor selecciona un evento e ingresa el número de dorsal",
        variant: "destructive",
      });
      return;
    }

    generateCodeMutation.mutate({
      eventId: parseInt(selectedEventId),
      dorsalNumber: parseInt(dorsalNumber),
      expiresInDays: parseInt(expiresInDays),
      maxDownloads: parseInt(maxDownloads),
    });
  };

  const copyCodeToClipboard = async () => {
    if (!generatedCode) return;
    
    const message = `🏃 Tu código de descarga: ${generatedCode.code}

📱 Ingresa en: photoracepro.com
📋 Código: ${generatedCode.code}
📅 Dorsal: ${generatedCode.dorsalNumber}
⏰ Válido hasta: ${new Date(generatedCode.expiresAt).toLocaleDateString('es-ES')}
📥 Descargas permitidas: ${generatedCode.maxDownloads}

¡Disfruta tus fotos! 📸`;

    try {
      await navigator.clipboard.writeText(message);
      setIsCopied(true);
      toast({
        title: "✅ Copiado al portapapeles",
        description: "Mensaje listo para enviar por WhatsApp",
      });
      
      setTimeout(() => setIsCopied(false), 3000);
    } catch (error) {
      toast({
        title: "Error al copiar",
        description: "No se pudo copiar al portapapeles",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader onLogout={onLogout} />
      
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <QrCode className="h-8 w-8 text-blue-600" />
            Generar Códigos de Descarga
          </h1>
          <p className="text-gray-600 mt-2">
            Genera códigos para clientes que confirmaron pagos por Nequi/transferencia
          </p>
        </div>

        {/* Workflow Steps */}
        <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Flujo de Trabajo Nequi/WhatsApp
          </h3>
          <div className="flex items-center gap-4 text-sm text-blue-700">
            <span className="bg-blue-100 px-3 py-1 rounded-full">1. Cliente paga por Nequi</span>
            <ArrowRight className="h-4 w-4" />
            <span className="bg-blue-100 px-3 py-1 rounded-full">2. Envía comprobante + dorsal</span>
            <ArrowRight className="h-4 w-4" />
            <span className="bg-blue-200 px-3 py-1 rounded-full font-semibold">3. Admin genera código</span>
            <ArrowRight className="h-4 w-4" />
            <span className="bg-blue-100 px-3 py-1 rounded-full">4. Cliente descarga fotos</span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Form Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Generar Código de Descarga
              </CardTitle>
              <CardDescription>
                Completa los datos para generar un código único para el cliente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-generate-code">
                <div className="space-y-2">
                  <Label htmlFor="event">Evento (Solo Eventos Pagos)</Label>
                  <Select 
                    value={selectedEventId} 
                    onValueChange={setSelectedEventId}
                    data-testid="select-event"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={eventsLoading ? "Cargando eventos..." : "Selecciona un evento"} />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id.toString()}>
                          {event.name} - {new Date(event.date).toLocaleDateString('es-ES')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dorsal">Número de Dorsal</Label>
                  <Input
                    id="dorsal"
                    type="number"
                    value={dorsalNumber}
                    onChange={(e) => setDorsalNumber(e.target.value)}
                    placeholder="Ej: 1234"
                    required
                    data-testid="input-dorsal"
                  />
                </div>

                <Separator />
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiration">Días de Vigencia</Label>
                    <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                      <SelectTrigger data-testid="select-expiration">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 días</SelectItem>
                        <SelectItem value="15">15 días</SelectItem>
                        <SelectItem value="30">30 días</SelectItem>
                        <SelectItem value="60">60 días</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="downloads">Descargas Máximas</Label>
                    <Select value={maxDownloads} onValueChange={setMaxDownloads}>
                      <SelectTrigger data-testid="select-downloads">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 descargas</SelectItem>
                        <SelectItem value="5">5 descargas</SelectItem>
                        <SelectItem value="10">10 descargas</SelectItem>
                        <SelectItem value="20">20 descargas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={generateCodeMutation.isPending}
                  data-testid="button-generate"
                >
                  {generateCodeMutation.isPending ? "Generando..." : "🎯 Generar Código"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Generated Code Display */}
          <Card className={generatedCode ? "border-green-200 bg-green-50" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Código Generado
              </CardTitle>
              <CardDescription>
                Código listo para enviar al cliente por WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              {generatedCode ? (
                <div className="space-y-4">
                  {/* Code Display */}
                  <div className="text-center p-6 bg-white border-2 border-green-300 rounded-lg">
                    <div className="text-4xl font-bold text-green-600 mb-2" data-testid="text-generated-code">
                      {generatedCode.code}
                    </div>
                    <div className="text-sm text-gray-600">
                      Dorsal: {generatedCode.dorsalNumber} | Evento: {generatedCode.eventName}
                    </div>
                  </div>

                  {/* Code Details */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>Expira: {new Date(generatedCode.expiresAt).toLocaleDateString('es-ES')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-gray-500" />
                      <span>{generatedCode.maxDownloads} descargas</span>
                    </div>
                  </div>

                  {/* Copy Button */}
                  <Button 
                    onClick={copyCodeToClipboard}
                    variant="outline" 
                    className="w-full border-green-300 text-green-700 hover:bg-green-100"
                    data-testid="button-copy-whatsapp"
                  >
                    {isCopied ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        ¡Copiado para WhatsApp!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        📱 Copiar Mensaje para WhatsApp
                      </>
                    )}
                  </Button>

                  <Alert className="border-green-200 bg-green-50">
                    <MessageCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Instrucciones:</strong> El mensaje ya está listo para copiar y enviar por WhatsApp al cliente. 
                      Incluye el código, dorsal, fecha de expiración y límite de descargas.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <QrCode className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p>Genera un código para verlo aquí</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}