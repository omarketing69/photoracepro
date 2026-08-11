/**
 * Utilidad compartida para mapeo canónico de IDs de eventos
 * Resuelve consolidación UFPS y otros mapeos futuros
 */

// Mapeo de eventos consolidados - Para encontrar archivos físicos
// CORREGIDO: El evento UFPS es el 6, no necesita canonicalización
const EVENT_ALIASES = new Map<number, number>([
  // Eliminado mapeo incorrecto 6→8 que causaba "Event 8 not found"
  // El evento 6 (UFPS) debe permanecer como 6
]);

/**
 * Obtener el ID canónico de un evento
 * Para casos como UFPS donde múltiples IDs apuntan al mismo evento real
 */
export function canonicalEventId(eventId: number): number {
  return EVENT_ALIASES.get(eventId) ?? eventId;
}

/**
 * Verificar si un evento requiere mapeo canónico
 */
export function requiresCanonicalMapping(eventId: number): boolean {
  return EVENT_ALIASES.has(eventId);
}

/**
 * Obtener todos los alias de un evento canónico
 */
export function getEventAliases(canonicalId: number): number[] {
  const aliases: number[] = [canonicalId]; // Incluir el ID principal
  
  EVENT_ALIASES.forEach((canonical, alias) => {
    if (canonical === canonicalId) {
      aliases.push(alias);
    }
  });
  
  return aliases;
}