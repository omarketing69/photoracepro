import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { insertPhotographerApplicationSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Camera, Star, Award, Users, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PhotographerSignup() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(insertPhotographerApplicationSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      city: "",
      experience: "",
      cameraType: "",
      cameraModel: "",
      lensDetails: "",
      portfolioUrl: "",
      previousEvents: "",
      availability: "",
      message: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/photographer-applications", "POST", data);
    },
    onSuccess: () => {
      setIsSubmitted(true);
      toast({
        title: "¡Aplicación enviada exitosamente!",
        description: "Te contactaremos pronto para discutir oportunidades.",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Error al enviar aplicación",
        description: "Por favor intenta nuevamente",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    mutation.mutate(data);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-green-100 rounded-full w-16 h-16 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-700">¡Aplicación Enviada!</CardTitle>
            <CardDescription className="text-lg">
              Gracias por tu interés en unirte al equipo photoracepro.com
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Hemos recibido tu aplicación y la revisaremos cuidadosamente. 
              Te contactaremos en los próximos días para discutir oportunidades disponibles.
            </p>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Próximos pasos:</strong><br/>
                • Revisaremos tu aplicación en 2-3 días laborales<br/>
                • Te contactaremos por email o teléfono<br/>
                • Programaremos una entrevista si hay oportunidades disponibles
              </p>
            </div>
            <Button 
              onClick={() => window.location.href = "/"}
              className="mt-6"
            >
              Volver al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="container mx-auto px-4">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Camera className="w-16 h-16 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Únete al Equipo photoracepro.com
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            ¿Eres fotógrafo profesional y quieres ganar dinero capturando momentos únicos en eventos deportivos? 
            Únete a nuestro equipo y forma parte de la revolución en fotografía deportiva.
          </p>
        </div>

        {/* Benefits Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="text-center">
            <CardHeader>
              <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <CardTitle className="text-lg">Trabajo Flexible</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Elige eventos según tu disponibilidad y horarios preferidos
              </p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardHeader>
              <Award className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <CardTitle className="text-lg">Ingresos Competitivos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Gana dinero por evento más comisiones por ventas de fotos
              </p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardHeader>
              <Users className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <CardTitle className="text-lg">Comunidad Profesional</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Conecta con otros fotógrafos y accede a eventos exclusivos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Application Form */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Formulario de Aplicación</CardTitle>
            <CardDescription>
              Comparte tu información para que podamos contactarte cuando tengamos eventos disponibles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Datos Personales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Juan Pérez González" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="ejemplo@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono *</FormLabel>
                        <FormControl>
                          <Input placeholder="+57 300 123 4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ciudad *</FormLabel>
                        <FormControl>
                          <Input placeholder="Bogotá, Colombia" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Información Profesional */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Información Profesional</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="experience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nivel de experiencia *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona tu nivel" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="beginner">Principiante (0-2 años)</SelectItem>
                              <SelectItem value="intermediate">Intermedio (2-5 años)</SelectItem>
                              <SelectItem value="advanced">Avanzado (5+ años)</SelectItem>
                              <SelectItem value="professional">Profesional (10+ años)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="availability"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Disponibilidad *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona tu disponibilidad" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="weekends">Solo fines de semana</SelectItem>
                              <SelectItem value="weekdays">Solo días laborales</SelectItem>
                              <SelectItem value="flexible">Flexible (cualquier día)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Equipo Fotográfico */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Equipo Fotográfico</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="cameraType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de cámara</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona tipo de cámara (opcional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="DSLR">DSLR</SelectItem>
                              <SelectItem value="Mirrorless">Mirrorless</SelectItem>
                              <SelectItem value="Professional">Cámara profesional</SelectItem>
                              <SelectItem value="Other">Otro</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="cameraModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modelo de cámara</FormLabel>
                          <FormControl>
                            <Input placeholder="Canon EOS R5, Sony A7 IV, etc. (opcional)" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="lensDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Detalles de lentes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe los lentes que utilizas (70-200mm f/2.8, 24-70mm f/2.8, etc.)"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Comparte información sobre tu equipo de lentes
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Información Adicional */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Información Adicional</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="portfolioUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL del portafolio o Instagram (si tiene)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://mi-portafolio.com o @mi_instagram" {...field} />
                          </FormControl>
                          <FormDescription>
                            Sitio web, Instagram, o galería online (opcional)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="previousEvents"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Eventos previos</FormLabel>
                          <FormControl>
                            <Input placeholder="Maratón de Bogotá, Carrera 10K, etc." {...field} />
                          </FormControl>
                          <FormDescription>
                            Eventos deportivos que has fotografiado
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mensaje adicional</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Cuéntanos por qué te interesa trabajar con photoracepro.com y qué puedes aportar al equipo..."
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Comparte cualquier información adicional que consideres relevante
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-center pt-6">
                  <Button 
                    type="submit" 
                    size="lg" 
                    disabled={mutation.isPending}
                    className="min-w-48"
                  >
                    {mutation.isPending ? "Enviando..." : "Enviar Aplicación"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}