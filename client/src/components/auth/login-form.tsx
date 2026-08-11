import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LogIn, User, Lock, Camera } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import heroImage from "@assets/a-photograph-of-a-stylized-logo-for-race_6KCjcglJTz-0j8p9B-pYJQ_Qs02YVLXSO-J94EuMmuVqA_1751305072861.png";

const loginSchema = z.object({
  email: z.string().email("Email válido requerido"),
  password: z.string().min(6, "Contraseña debe tener al menos 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onLogin: (user: { id: number; email: string; role: string; name?: string }) => void;
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    
    try {
      // Simulate authentication
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock user data based on email
      let user;
      if (data.email === "admin@racephoto.com") {
        user = {
          id: 1,
          email: data.email,
          role: "admin",
          name: "Administrador"
        };
      } else {
        user = {
          id: 2,
          email: data.email,
          role: "user",
          name: "Usuario"
        };
      }

      onLogin(user);
      
      toast({
        title: "Acceso exitoso",
        description: `Bienvenido${user.role === 'admin' ? ' al panel de administración' : ' al portal de participantes'}`,
      });
    } catch (error) {
      toast({
        title: "Error de acceso",
        description: "Email o contraseña incorrectos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Demo credentials removed for security

  return (
    <div className="min-h-screen flex">
      {/* Hero Section with Background Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-black bg-opacity-40"></div>
        </div>
        <div className="relative z-10 flex items-center justify-center p-12">
          <div className="text-center text-white">
            <h1 className="text-4xl font-bold mb-4">photoracepro.com</h1>
            <p className="text-xl mb-6 opacity-90">
              Reconocimiento automático de dorsales y gestión profesional de fotografías deportivas
            </p>
            <div className="space-y-2 text-left">
              <div className="flex items-center space-x-2">
                <Camera className="h-5 w-5" />
                <span>Detección automática de dorsales con OCR</span>
              </div>
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Reconocimiento facial avanzado</span>
              </div>
              <div className="flex items-center space-x-2">
                <LogIn className="h-5 w-5" />
                <span>Portal de participantes integrado</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Login Form Section */}
      <div className="flex-1 flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 lg:bg-gradient-to-l lg:from-gray-50 lg:to-white">
        <div className="w-full max-w-md">
          {/* Mobile Header */}
          <div className="text-center mb-8 lg:hidden">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Camera className="text-primary text-3xl" />
              <h1 className="text-2xl font-bold text-gray-900">photoracepro.com</h1>
            </div>
            <p className="text-gray-600">
              Plataforma de fotografías de carreras atléticas
            </p>
          </div>

          {/* Login Card */}
          <Card className="border border-gray-200 shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <h2 className="text-xl font-semibold text-center text-gray-900">
                Iniciar Sesión
              </h2>
              <p className="text-sm text-gray-600 text-center">
                Accede con tu cuenta para continuar
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      className="pl-10"
                      {...form.register("email")}
                    />
                  </div>
                  {form.formState.errors.email && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      {...form.register("password")}
                    />
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary text-white hover:bg-blue-700"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  {isLoading ? "Accediendo..." : "Iniciar Sesión"}
                </Button>
              </form>

              {/* Demo Access removed for security */}

              {/* Footer Info */}
              <div className="text-center pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Sistema de reconocimiento automático de dorsales
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}