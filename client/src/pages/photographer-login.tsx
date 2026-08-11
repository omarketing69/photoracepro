import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, Lock, ArrowLeft, Upload } from 'lucide-react';
import { Link } from 'wouter';

interface PhotographerLoginProps {
  onLogin: (userData: { id: number; email: string; role: string; name?: string }) => void;
}

export default function PhotographerLogin({ onLogin }: PhotographerLoginProps) {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error("Credenciales inválidas");
      }

      const data = await response.json();

      if (!data.user) {
        setError("Respuesta del servidor inválida");
        return;
      }

      if (data.user.role !== "photographer") {
        setError("Esta página es solo para fotógrafos. Si eres administrador, usa el login de admin.");
        return;
      }

      // Set user and navigate immediately 
      console.log("Photographer login successful, setting user:", data.user);
      // Store both user and token together (like admin login)
      const userWithToken = { ...data.user, token: data.token };
      onLogin(userWithToken);
      
      // Small delay to ensure state is set before navigation
      setTimeout(() => {
        console.log("Navigating to upload area");
        setLocation("/upload");
      }, 100);
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Camera className="h-8 w-8 text-green-600 mr-2" />
              <span className="text-xl font-bold text-gray-900">photoracepro.com</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/admin-login">
                <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                  <Lock className="h-4 w-4 mr-2" />
                  Login Admin
                </Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver al inicio
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Login Form */}
      <div className="flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto bg-green-100 rounded-full p-3 w-12 h-12 flex items-center justify-center mb-4">
              <Upload className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Acceso Fotógrafos</CardTitle>
            <CardDescription>
              Ingresa tus credenciales para acceder al área de subida de fotos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu.email@ejemplo.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700" 
                disabled={isLoading}
              >
                {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
              </Button>
            </form>
            
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="text-center text-sm text-gray-600">
                <p className="mb-2">¿No tienes acceso?</p>
                <Link href="/soy-fotografo">
                  <Button variant="outline" className="text-green-600 border-green-600 hover:bg-green-50">
                    Solicitar acceso como fotógrafo
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}