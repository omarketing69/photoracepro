# Instrucciones para crear DATABASE_URL_NEW completa

El valor actual de DATABASE_URL_NEW es solo: `ep-bitter-glitter-aenqtais`

Esto es incorrecto. Necesitas la URL completa de PostgreSQL.

## Pasos para obtener la URL completa:

1. Ve a https://console.neon.tech/
2. Busca tu proyecto "RacePhoto-Recovery-2025" 
3. En el Dashboard, busca "Connection string" o "Database URL"
4. Copia la URL completa que debe verse así:
   ```
   postgresql://username:password@ep-bitter-glitter-aenqtais.us-east-1.aws.neon.tech:5432/neondb?sslmode=require
   ```

5. Actualiza el secreto DATABASE_URL_NEW con esta URL completa (no solo el endpoint)

## La URL debe incluir:
- `postgresql://` (protocolo)
- `username:password@` (credenciales)
- `ep-bitter-glitter-aenqtais.us-east-1.aws.neon.tech:5432` (host y puerto)
- `/neondb` (nombre de base de datos)
- `?sslmode=require` (parámetros SSL)

Una vez que actualices DATABASE_URL_NEW con la URL completa, podré restaurar todo el sistema inmediatamente.