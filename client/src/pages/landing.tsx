import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Search, ShoppingCart, Zap, Users, Trophy, ChevronRight } from "lucide-react";
import { Link } from "wouter";
// Try direct URL approach for troubleshooting
// import heroImage from "@assets/a-photograph-of-a-stylized-logo-for-race_6KCjcglJTz-0j8p9B-pYJQ_Qs02YVLXSO-J94EuMmuVqA (1)_1751662078750.png";

export default function Landing() {
  // Debug: Log to check if image URL is accessible
  console.log('Testing image URL:', '/attached_assets/image_1751420887730.png');
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Camera className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mr-2" />
              <span className="text-lg sm:text-xl font-bold text-gray-900">photoracepro.com</span>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-6">
              <Link href="/search">
                <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                  <Search className="h-4 w-4 mr-2" />
                  Buscar Fotos
                </Button>
              </Link>
              <Link href="/free-photos">
                <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                  Fotos Gratuitas
                </Button>
              </Link>
              <Link href="/soy-fotografo">
                <Button variant="ghost" className="text-gray-600 hover:text-gray-900 text-sm">
                  Soy fotógrafo quiero ganar $$
                </Button>
              </Link>
              <Link href="/photographer-login">
                <Button variant="outline" size="sm" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
                  Login Fotógrafo
                </Button>
              </Link>
              <Link href="/admin-login">
                <Button variant="outline" size="sm">
                  Admin
                </Button>
              </Link>
            </nav>
            
            {/* Mobile Navigation */}
            <div className="lg:hidden flex items-center space-x-2">
              <Link href="/search">
                <Button variant="ghost" size="sm" className="text-xs">
                  <Search className="h-3 w-3 mr-1" />
                  Buscar
                </Button>
              </Link>
              <Link href="/photographer-login">
                <Button variant="outline" size="sm" className="text-xs bg-green-50 text-green-700">
                  Fotógrafo
                </Button>
              </Link>
              <Link href="/admin-login">
                <Button variant="outline" size="sm" className="text-xs">
                  Admin
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center">
        <div className="w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 h-screen items-center">
            {/* Left Column - Image (Full height on desktop, reduced on mobile) */}
            <div className="h-64 md:h-screen w-full bg-blue-600 flex items-center justify-center">
              <img 
                src="/attached_assets/a-photograph-of-a-stylized-logo-for-race_6KCjcglJTz-0j8p9B-pYJQ_Qs02YVLXSO-J94EuMmuVqA (1)_1751662078750.png"
                alt="photo race pro Logo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to SVG logo if PNG fails to load
                  const target = e.target as HTMLImageElement;
                  target.src = "/attached_assets/logo.svg";
                  target.style.objectFit = "contain";
                  target.style.padding = "2rem";
                }}
              />
            </div>
            
            {/* Right Column - Text and Buttons */}
            <div className="flex items-center justify-center px-4 sm:px-8 py-8 md:py-12">
              <div className="text-center lg:text-left">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight">
                Encuentra tus fotos de
                <span className="text-blue-600"> carrera</span> al instante
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8 leading-relaxed">
                Sistema automatizado de fotografía deportiva con reconocimiento de dorsales. 
                Busca, encuentra y descarga tus fotos de manera rápida y segura.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
                <Link href="/search">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-6 sm:px-8 py-2 sm:py-3 w-full sm:w-auto">
                    <Search className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Buscar mis fotos
                    <ChevronRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </Link>
                <Link href="/free-photos">
                  <Button size="lg" variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-100 px-6 sm:px-8 py-2 sm:py-3 w-full sm:w-auto">
                    Ver fotos gratuitas
                  </Button>
                </Link>
              </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">¿Cómo funciona?</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Nuestro sistema utiliza inteligencia artificial para organizar automáticamente 
              las fotos por número de dorsal
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <Search className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Busca por dorsal</CardTitle>
                <CardDescription>
                  Ingresa tu número de dorsal y encuentra todas tus fotos instantáneamente
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Reconocimiento automático</CardTitle>
                <CardDescription>
                  IA avanzada detecta dorsales y organiza las fotos sin intervención manual
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <ShoppingCart className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>Descarga segura</CardTitle>
                <CardDescription>
                  Compra y descarga tus fotos en alta resolución con pago seguro
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Confiado por atletas</h2>
            <p className="text-gray-600">Miles de deportistas ya han encontrado sus mejores momentos</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">2000+</div>
              <div className="text-gray-600">Fotos procesadas</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-green-600 mb-2">95%</div>
              <div className="text-gray-600">Precisión en detección</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-purple-600 mb-2">500+</div>
              <div className="text-gray-600">Atletas satisfechos</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-4">
            ¿Listo para encontrar tus fotos?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Comienza tu búsqueda ahora y revive tus mejores momentos deportivos
          </p>
          <Link href="/search">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3">
              <Search className="mr-2 h-5 w-5" />
              Buscar mis fotos ahora
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <Camera className="h-8 w-8 text-blue-400 mr-2" />
                <span className="text-xl font-bold">photoracepro.com</span>
              </div>
              <p className="text-gray-400">
                Plataforma líder en fotografía deportiva automatizada
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Servicios</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/search">Búsqueda de fotos</Link></li>
                <li><Link href="/free-photos">Fotos gratuitas</Link></li>
                <li>Eventos deportivos</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Soporte</h3>
              <ul className="space-y-2 text-gray-400">
                <li>Centro de ayuda</li>
                <li>Contacto</li>
                <li>Términos de servicio</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Síguenos</h3>
              <div className="flex space-x-4">
                <Users className="h-5 w-5 text-gray-400 hover:text-white cursor-pointer" />
                <Trophy className="h-5 w-5 text-gray-400 hover:text-white cursor-pointer" />
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 photoracepro.com. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}