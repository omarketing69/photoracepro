import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, DollarSign, Camera, MessageCircle, Download, Info, Copy, Check, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface NequiPaymentInstructionsProps {
  collapsed?: boolean;
  showTitle?: boolean;
  className?: string;
}

export default function NequiPaymentInstructions({ 
  collapsed = false, 
  showTitle = true,
  className = ""
}: NequiPaymentInstructionsProps) {
  const [isOpen, setIsOpen] = useState(!collapsed);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const phoneNumber = "3174303982";

  const copyPhoneNumber = () => {
    navigator.clipboard.writeText(phoneNumber);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const openWhatsApp = () => {
    window.open(`https://wa.me/57${phoneNumber}`, '_blank');
  };

  const steps = [
    {
      id: 1,
      icon: <DollarSign className="h-6 w-6 text-purple-600" />,
      title: "Realiza depósito Nequi",
      description: `Envía el dinero por Nequi al número ${phoneNumber}`,
      color: "purple",
      details: "Usa tu app Nequi para enviar el pago del valor de las fotos"
    },
    {
      id: 2,
      icon: <Camera className="h-6 w-6 text-blue-600" />,
      title: "Toma captura de pantalla",
      description: "Del comprobante de pago exitoso",
      color: "blue",
      details: "Asegúrate que se vea claramente el valor y el número de destino"
    },
    {
      id: 3,
      icon: <MessageCircle className="h-6 w-6 text-green-600" />,
      title: "Envía por WhatsApp",
      description: `Captura + número de dorsal al ${phoneNumber}`,
      color: "green",
      details: "Incluye: screenshot del pago + tu número de dorsal"
    },
    {
      id: 4,
      icon: <Phone className="h-6 w-6 text-orange-600" />,
      title: "Recibirás tu código",
      description: "Te enviaremos el código de descarga por WhatsApp",
      color: "orange",
      details: "Respuesta rápida con tu código personalizado"
    },
    {
      id: 5,
      icon: <Download className="h-6 w-6 text-indigo-600" />,
      title: "Usa el código",
      description: "En el botón 'Con código' de las fotos",
      color: "indigo",
      details: "Ingresa el código para descargar tus fotos en alta calidad"
    }
  ];

  if (collapsed) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
        <Card className="border-orange-200 bg-orange-50">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-orange-100 transition-colors">
              <CardTitle className="flex items-center justify-between text-orange-800">
                <div className="flex items-center">
                  <Info className="h-5 w-5 mr-2" />
                  <span className="text-lg">¿Cómo obtener código de descarga?</span>
                  <Badge variant="outline" className="ml-2 border-orange-300 text-orange-700">
                    Nequi + WhatsApp
                  </Badge>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 bg-white"
                  >
                    <div className="flex-shrink-0">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-${step.color}-100`}>
                        <span className={`text-xs font-bold text-${step.color}-600`}>{step.id}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        {step.icon}
                        <h4 className="text-sm font-semibold text-gray-900">{step.title}</h4>
                      </div>
                      <p className="text-xs text-gray-600 mb-1">{step.description}</p>
                      <p className="text-xs text-gray-500">{step.details}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">Número de contacto:</h4>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-600" />
                    <span className="font-mono text-lg font-bold text-gray-900">{phoneNumber}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyPhoneNumber}
                      className="h-8"
                      data-testid="button-copy-phone"
                    >
                      {copiedPhone ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span className="ml-1 text-xs">{copiedPhone ? 'Copiado' : 'Copiar'}</span>
                    </Button>
                    <Button
                      onClick={openWhatsApp}
                      className="h-8 bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                      data-testid="button-open-whatsapp"
                    >
                      <MessageCircle className="h-3 w-3 mr-1" />
                      <span className="text-xs">Abrir WhatsApp</span>
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <Info className="h-4 w-4 inline mr-1" />
                  <strong>Tip:</strong> Ten listo tu número de dorsal antes de enviar el mensaje por WhatsApp
                </p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  return (
    <Card className={`${className} border-orange-200 bg-gradient-to-br from-orange-50 to-yellow-50`}>
      {showTitle && (
        <CardHeader className="text-center">
          <CardTitle className="text-xl text-orange-900 flex items-center justify-center">
            <Info className="h-6 w-6 mr-2" />
            Instrucciones de Pago - Código de Descarga
          </CardTitle>
          <div className="flex items-center justify-center space-x-2 mt-2">
            <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50">
              Nequi
            </Badge>
            <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
              WhatsApp
            </Badge>
          </div>
        </CardHeader>
      )}
      
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.id}
              className="relative p-4 rounded-xl border-2 border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow"
              data-testid={`step-${step.id}`}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full bg-${step.color}-100 border-2 border-${step.color}-200`}>
                  <span className={`text-lg font-bold text-${step.color}-700`}>{step.id}</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-center space-x-2">
                    {step.icon}
                    <h3 className="font-semibold text-gray-900">{step.title}</h3>
                  </div>
                  <p className="text-sm text-gray-700 font-medium">{step.description}</p>
                  <p className="text-xs text-gray-500">{step.details}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Contact Information */}
        <div className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
            Número de Contacto
          </h3>
          <div className="flex items-center justify-center space-x-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Phone className="h-5 w-5 text-gray-600" />
              <span className="font-mono text-2xl font-bold text-gray-900">{phoneNumber}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-center space-x-3 mt-4">
            <Button
              variant="outline"
              onClick={copyPhoneNumber}
              className="flex items-center space-x-2"
              data-testid="button-copy-phone-main"
            >
              {copiedPhone ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span>{copiedPhone ? 'Número copiado' : 'Copiar número'}</span>
            </Button>
            
            <Button
              onClick={openWhatsApp}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center space-x-2"
              data-testid="button-open-whatsapp-main"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Abrir WhatsApp</span>
            </Button>
          </div>
        </div>
        
        {/* Important Notes */}
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
          <div className="flex items-start space-x-2">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="font-semibold text-blue-900">Información importante:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Asegúrate de tener tu número de dorsal antes de enviar el mensaje</li>
                <li>• El código de descarga es válido solo para las fotos de tu dorsal</li>
                <li>• Recibirás respuesta rápida durante horario laboral</li>
                <li>• Guarda bien tu código, lo necesitarás para cada descarga</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}