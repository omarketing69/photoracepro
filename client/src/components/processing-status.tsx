import { useState, useRef } from "react";
import { CloudUpload, Image, FileImage, Check, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface ProcessingItem {
  id: string;
  filename: string;
  size: string;
  progress: number;
  status: "uploading" | "processing" | "completed" | "error";
}

export default function ProcessingStatus() {
  const [processingQueue, setProcessingQueue] = useState<ProcessingItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newItems: ProcessingItem[] = Array.from(files).map((file, index) => ({
      id: `${Date.now()}-${index}`,
      filename: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      progress: 0,
      status: "uploading" as const,
    }));

    setProcessingQueue(prev => [...prev, ...newItems]);

    // Simulate upload and processing
    newItems.forEach((item, index) => {
      setTimeout(() => {
        simulateProcessing(item.id);
      }, index * 500);
    });

    toast({
      title: "Fotos agregadas",
      description: `Se agregaron ${files.length} fotos a la cola de procesamiento.`,
    });
  };

  const simulateProcessing = (itemId: string) => {
    const interval = setInterval(() => {
      setProcessingQueue(prev => prev.map(item => {
        if (item.id === itemId) {
          const newProgress = Math.min(item.progress + Math.random() * 20, 100);
          const newStatus = newProgress === 100 ? "completed" : item.status;
          return { ...item, progress: newProgress, status: newStatus };
        }
        return item;
      }));
    }, 200);

    setTimeout(() => {
      clearInterval(interval);
      setProcessingQueue(prev => prev.map(item => 
        item.id === itemId ? { ...item, progress: 100, status: "completed" } : item
      ));
    }, 3000 + Math.random() * 2000);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div className="space-y-6">
      {/* Photo Upload Section */}
      <Card className="border border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Subida de Fotografías</h3>
        </CardHeader>
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-gray-300 hover:border-primary"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <CloudUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">Subir Fotos del Evento</p>
            <p className="text-gray-600 mb-4">Arrastra archivos aquí o haz click para seleccionar</p>
            <p className="text-sm text-gray-500">Soporta: JPG, PNG, TIFF (máx. 10MB c/u)</p>
            <Button className="mt-4 bg-primary text-white hover:bg-blue-700">
              Seleccionar Archivos
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
          </div>

          {/* Processing Queue */}
          {processingQueue.length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">Cola de Procesamiento</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {processingQueue.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                        {item.status === "completed" ? (
                          <Check className="h-5 w-5 text-green-500" />
                        ) : item.status === "error" ? (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <FileImage className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.filename}</p>
                        <p className="text-xs text-gray-600">{item.size}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-16">
                        <Progress value={item.progress} className="h-2" />
                      </div>
                      <span className="text-xs text-gray-600 w-10">{Math.round(item.progress)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing Statistics */}
      <Card className="border border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Estado del Procesamiento</h3>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Reconocimiento OCR</span>
            <div className="flex items-center space-x-2">
              <div className="w-20 bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: "87%" }} />
              </div>
              <span className="text-sm font-medium text-green-500">87%</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Detección Facial</span>
            <div className="flex items-center space-x-2">
              <div className="w-20 bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: "92%" }} />
              </div>
              <span className="text-sm font-medium text-green-500">92%</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Organización Auto</span>
            <div className="flex items-center space-x-2">
              <div className="w-20 bg-gray-200 rounded-full h-2">
                <div className="bg-orange-500 h-2 rounded-full" style={{ width: "64%" }} />
              </div>
              <span className="text-sm font-medium text-orange-500">64%</span>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">Tiempo Promedio por Foto</span>
              <span className="font-medium text-gray-900">3.2 seg</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Fotos Pendientes</span>
              <span className="font-medium text-gray-900">{processingQueue.filter(item => item.status !== "completed").length}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
