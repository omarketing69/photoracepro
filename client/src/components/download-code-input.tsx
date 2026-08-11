import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Download, Loader2, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";

interface DownloadCodeInputProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: number;
  dorsalNumber: number;
  filename: string;
  photoName?: string;
}

interface ValidationResponse {
  valid: boolean;
  error?: string;
  downloadCode?: {
    id: number;
    eventId: number;
    dorsalNumber: number;
    code: string;
    maxDownloads: number;
    downloadCount: number;
  };
  remainingDownloads?: number;
}

export function DownloadCodeInput({
  isOpen,
  onClose,
  eventId,
  dorsalNumber,
  filename,
  photoName
}: DownloadCodeInputProps) {
  const [code, setCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [remainingDownloads, setRemainingDownloads] = useState<number | null>(null);

  const handleClose = () => {
    setCode("");
    setError("");
    setValidationSuccess(false);
    setRemainingDownloads(null);
    onClose();
  };

  const validateAndDownload = async () => {
    if (!code.trim()) {
      setError("Por favor ingresa un código de descarga");
      return;
    }

    setIsValidating(true);
    setError("");

    try {
      // Validate the download code
      const res = await apiRequest("POST", "/api/download-codes/validate", {
        code: code.trim().toUpperCase(),
        eventId,
        dorsalNumber
      });

      const response: ValidationResponse = await res.json();

      if (!response.valid) {
        setError(response.error || "Código de descarga inválido");
        setIsValidating(false);
        return;
      }

      setValidationSuccess(true);
      setRemainingDownloads(response.remainingDownloads || 0);
      setIsValidating(false);

      // Start download
      setTimeout(() => {
        downloadPhoto(code.trim().toUpperCase());
      }, 1000);

    } catch (err) {
      console.error("Error validating download code:", err);
      setError("Error al validar el código. Por favor intenta de nuevo.");
      setIsValidating(false);
    }
  };

  const downloadPhoto = async (validatedCode: string) => {
    setIsDownloading(true);

    try {
      // Create download URL and trigger download
      const downloadUrl = `/api/download-codes/download/${validatedCode}/${filename}`;
      
      // Create a temporary link to trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Close modal after short delay
      setTimeout(() => {
        handleClose();
      }, 2000);

    } catch (err) {
      console.error("Error downloading photo:", err);
      setError("Error al descargar la foto. Por favor intenta de nuevo.");
      setIsDownloading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isValidating && !isDownloading && !validationSuccess) {
      validateAndDownload();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Descargar con Código
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {photoName && (
            <div className="text-sm text-gray-600">
              <strong>Foto:</strong> {photoName}
            </div>
          )}
          
          <div className="text-sm text-gray-600">
            <strong>Evento:</strong> {eventId} | <strong>Dorsal:</strong> {dorsalNumber}
          </div>

          {!validationSuccess && (
            <>
              <div className="space-y-2">
                <Label htmlFor="download-code">Código de Descarga</Label>
                <Input
                  id="download-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyPress={handleKeyPress}
                  placeholder="Ingresa tu código (ej: PHOTO123)"
                  disabled={isValidating}
                  className="font-mono text-center text-lg tracking-widest"
                  data-testid="input-download-code"
                />
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p>• El código debe ser válido para este evento y dorsal</p>
                <p>• Los códigos pueden tener un límite de descargas</p>
                <p>• Algunos códigos pueden tener fecha de expiración</p>
              </div>
            </>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {validationSuccess && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <div className="space-y-1">
                  <div className="font-semibold">¡Código válido!</div>
                  <div className="text-sm">
                    Descargas restantes: {remainingDownloads}
                  </div>
                  <div className="text-sm">
                    {isDownloading ? "Descargando foto..." : "Iniciando descarga..."}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 pt-4">
            {!validationSuccess && (
              <Button
                onClick={validateAndDownload}
                disabled={!code.trim() || isValidating}
                className="flex-1"
                data-testid="button-validate-code"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Validar y Descargar
                  </>
                )}
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isValidating || isDownloading}
              data-testid="button-cancel"
            >
              {isDownloading ? "Descargando..." : "Cancelar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}