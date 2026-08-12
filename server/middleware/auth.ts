import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

interface AuthenticatedUser {
  id: number;
  email: string;
  role: string;
  name: string;
}

interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// JWT Secret - debe estar en variables de entorno. Nunca usar un fallback
// hardcodeado (sería forjable por cualquier atacante que lea el repo).
const DEFAULT_SECRET_WARNING = 'racephoto-ultra-secure-jwt-secret-key-2025';
const isProd = process.env.NODE_ENV === 'production';
if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET environment variable is required and must be >= 32 chars in production.');
}
const JWT_SECRET = process.env.JWT_SECRET || (isProd ? '' : DEFAULT_SECRET_WARNING);
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const ADMIN_SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos para admin

// Rate limiting storage - en producción usar Redis
const loginAttempts = new Map<string, { count: number; lastAttempt: number; blocked: boolean }>();
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutos de bloqueo

// Audit log storage - en producción usar base de datos
interface AuditLogEntry {
  timestamp: Date;
  userId: number;
  userEmail: string;
  action: string;
  ip: string;
  userAgent: string;
  details?: any;
}

const auditLog: AuditLogEntry[] = [];

/**
 * Función para firmar tokens JWT seguros para administradores
 */
export function signAdminToken(user: AuthenticatedUser): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required for secure authentication');
  }

  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: 'HS256',
    issuer: 'racephoto-pro',
    subject: user.id.toString(),
  });
}

/**
 * Función para verificar y decodificar tokens JWT
 */
export function verifyToken(token: string): JWTPayload {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required for secure authentication');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'racephoto-pro',
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired. Please login again.');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token format.');
    } else {
      throw new Error('Token verification failed.');
    }
  }
}

/**
 * Rate limiting para intentos de login
 */
export function checkLoginRateLimit(ip: string): { allowed: boolean; remainingAttempts: number; blockTimeRemaining: number } {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);

  if (!attempts) {
    loginAttempts.set(ip, { count: 0, lastAttempt: now, blocked: false });
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS, blockTimeRemaining: 0 };
  }

  // Reset si ha pasado tiempo suficiente
  if (now - attempts.lastAttempt > BLOCK_DURATION) {
    loginAttempts.set(ip, { count: 0, lastAttempt: now, blocked: false });
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS, blockTimeRemaining: 0 };
  }

  if (attempts.blocked) {
    const blockTimeRemaining = BLOCK_DURATION - (now - attempts.lastAttempt);
    return { allowed: false, remainingAttempts: 0, blockTimeRemaining };
  }

  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    attempts.blocked = true;
    attempts.lastAttempt = now;
    return { allowed: false, remainingAttempts: 0, blockTimeRemaining: BLOCK_DURATION };
  }

  return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS - attempts.count, blockTimeRemaining: 0 };
}

/**
 * Registrar intento de login fallido
 */
export function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);

  if (!attempts) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now, blocked: false });
  } else {
    attempts.count++;
    attempts.lastAttempt = now;
    
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      attempts.blocked = true;
    }
  }
}

/**
 * Limpiar intentos de login exitoso
 */
export function clearLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

/**
 * Log de auditoría para acciones administrativas
 */
export function logAdminAction(
  userId: number,
  userEmail: string,
  action: string,
  req: express.Request,
  details?: any
): void {
  const entry: AuditLogEntry = {
    timestamp: new Date(),
    userId,
    userEmail,
    action,
    ip: req?.ip || req?.connection?.remoteAddress || 'unknown',
    userAgent: req?.get?.('User-Agent') || 'unknown',
    details,
  };

  auditLog.push(entry);

  // En producción, guardar en base de datos
  console.log(`🔐 [AUDIT] ${userEmail} (${userId}) performed: ${action} from ${entry.ip}`);
  
  // Mantener solo los últimos 1000 logs en memoria
  if (auditLog.length > 1000) {
    auditLog.shift();
  }
}

/**
 * Obtener logs de auditoría (para admin dashboard)
 */
export function getAuditLogs(limit: number = 100): AuditLogEntry[] {
  return auditLog.slice(-limit).reverse();
}

/**
 * Middleware de autenticación segura para endpoints de administrador
 */
export async function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  try {
    // Verificar header de autorización
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        error: 'Authentication required - no token provided',
        code: 'NO_TOKEN'
      });
      return;
    }

    // Extraer token
    const token = authHeader.substring(7);
    if (!token) {
      res.status(401).json({ 
        error: 'Authentication required - empty token',
        code: 'EMPTY_TOKEN'
      });
      return;
    }

    // Verificar token JWT
    let decoded: JWTPayload;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      res.status(401).json({ 
        error: error instanceof Error ? error.message : 'Token verification failed',
        code: 'INVALID_TOKEN'
      });
      return;
    }

    // Verificar que el usuario existe en la base de datos
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.userId));

    if (!user) {
      res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Verificar que el usuario sigue siendo admin
    if (user.role !== 'admin') {
      logAdminAction(
        user.id,
        user.email,
        'UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT',
        req,
        { expectedRole: 'admin', actualRole: user.role }
      );

      res.status(403).json({ 
        error: 'Admin access required - user role changed',
        code: 'NOT_ADMIN'
      });
      return;
    }

    // Verificar que el email coincide (prevenir ataques de manipulación de tokens)
    if (user.email !== decoded.email) {
      logAdminAction(
        user.id,
        user.email,
        'TOKEN_EMAIL_MISMATCH',
        req,
        { tokenEmail: decoded.email, actualEmail: user.email }
      );

      res.status(401).json({ 
        error: 'Token validation failed - email mismatch',
        code: 'EMAIL_MISMATCH'
      });
      return;
    }

    // Agregar usuario autenticado al request
    (req as any).authenticatedUser = user;

    // Log de acceso exitoso (solo para acciones importantes)
    const importantPaths = ['/api/events', '/api/admin', '/api/users', '/upload'];
    if (importantPaths.some(path => req.path.startsWith(path))) {
      logAdminAction(
        user.id,
        user.email,
        `ADMIN_ACCESS_${req.method}`,
        req,
        { path: req.path, query: req.query }
      );
    }

    next();
  } catch (error) {
    console.error('❌ [AUTH] Authentication middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication server error',
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * Middleware de rate limiting para endpoints de login
 */
export function rateLimitLogin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const rateLimit = checkLoginRateLimit(ip);

  if (!rateLimit.allowed) {
    const minutes = Math.ceil(rateLimit.blockTimeRemaining / 60000);
    
    console.warn(`⚠️ [SECURITY] Login blocked for IP ${ip} - too many attempts`);
    
    res.status(429).json({
      error: `Too many login attempts. Please try again in ${minutes} minutes.`,
      code: 'RATE_LIMITED',
      blockTimeRemaining: rateLimit.blockTimeRemaining,
    });
    return;
  }

  res.locals.rateLimitInfo = rateLimit;
  next();
}

/**
 * Middleware para verificar sesiones de usuario regular (no admin)
 */
export async function requireUser(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.userId));

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    (req as any).authenticatedUser = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Validar configuración de seguridad
 */
export function validateSecurityConfig(): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters long for production');
  }

  if (!process.env.GOOGLE_CREDENTIALS_JSON) {
    warnings.push('GOOGLE_CREDENTIALS_JSON environment variable not set');
  }

  if (process.env.NODE_ENV === 'production' && JWT_SECRET.includes('racephoto-ultra-secure')) {
    warnings.push('Default JWT_SECRET detected in production - this is insecure');
  }

  return {
    isValid: warnings.length === 0,
    warnings
  };
}

// Log de inicialización de seguridad
const securityValidation = validateSecurityConfig();
if (!securityValidation.isValid) {
  console.warn('⚠️ [SECURITY] Configuration warnings:');
  securityValidation.warnings.forEach(warning => {
    console.warn(`   - ${warning}`);
  });
}

console.log('🔐 [SECURITY] JWT-based authentication middleware initialized');

/**
 * Generic authentication middleware - verifies JWT token
 */
export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Add authenticated user to request object
    (req as any).authenticatedUser = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    console.error('❌ [AUTH] Authentication error:', error);
    res.status(401).json({ 
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRoles(allowedRoles: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    // First ensure user is authenticated
    requireAuth(req, res, () => {
      const user = (req as any).authenticatedUser;
      
      if (!user || !allowedRoles.includes(user.role)) {
        console.log(`❌ [AUTH] Role authorization failed: ${user?.role} not in [${allowedRoles.join(', ')}]`);
        
        res.status(403).json({ 
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredRoles: allowedRoles,
          userRole: user?.role
        });
        return;
      }

      console.log(`✅ [AUTH] Role authorization success: ${user.role}`);
      next();
    });
  };
}

/**
 * Middleware for paid events requiring athlete login
 */
export function requireAthleteForPaidEvent() {
  return async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
    try {
      const eventId = parseInt(req.params.eventId || req.params.id || req.body.eventId);
      
      console.log(`🔍 [AUTH] Checking athlete requirement for event ${eventId}`);
      
      if (!eventId) {
        console.log(`🔍 [AUTH] No event ID found, allowing request`);
        next(); // No event ID, let it pass to next middleware
        return;
      }

      // Get event from database using direct imports
      const { events } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const [event] = await db.select().from(events).where(eq(events.id, eventId));
      
      if (!event) {
        console.log(`❌ [AUTH] Event ${eventId} not found`);
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      console.log(`🔍 [AUTH] Event ${eventId} requires athlete login: ${event.requiresAthleteLogin}`);

      // If event requires athlete login, enforce authentication
      if (event.requiresAthleteLogin) {
        console.log(`🔒 [AUTH] Event ${eventId} is paid - requiring athlete/admin authentication`);
        requireRoles(['athlete', 'admin'])(req, res, next);
      } else {
        console.log(`✅ [AUTH] Event ${eventId} is free - allowing access`);
        next(); // Event doesn't require athlete login, proceed
      }
    } catch (error) {
      console.error('❌ [AUTH] Error checking event athlete requirement:', error);
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
}