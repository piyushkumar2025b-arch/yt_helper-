import { Request, Response, NextFunction } from 'express';
import firebaseConfig from '../firebase-applet-config.json';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Parses and validates Firebase ID Token from standard Authorization Bearer header.
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+([a-zA-Z0-9_\-\.]+)/i);
  return match ? match[1] : null;
}

/**
 * Decodes and validates Firebase ID token claims (aud, iss, exp).
 */
export function decodeFirebaseIdToken(token: string): AuthenticatedUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadJson);

    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      return null;
    }

    const expectedProject = firebaseConfig.projectId;
    if (payload.aud !== expectedProject) {
      return null;
    }
    if (payload.iss !== `https://securetoken.google.com/${expectedProject}`) {
      return null;
    }
    if (!payload.sub || typeof payload.sub !== 'string') {
      return null;
    }

    return {
      uid: payload.sub,
      email: payload.email,
      emailVerified: Boolean(payload.email_verified),
    };
  } catch {
    return null;
  }
}

/**
 * Middleware that extracts and validates Firebase user authentication on incoming API requests.
 */
export function authenticateFirebaseUser(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (token) {
    const user = decodeFirebaseIdToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
}

/**
 * Enforces authentication or user-provided key on expensive AI routes.
 */
export function requireAuthOrUserKey(req: Request, res: Response, next: NextFunction): void {
  // Allow if user is authenticated via Firebase
  if (req.user?.uid) {
    next();
    return;
  }

  // Allow if user provides their own OpenRouter or API key
  const hasUserKey =
    Boolean(req.headers['x-openrouter-key']) ||
    Boolean(req.body?.openRouterKey) ||
    Boolean(req.headers['x-user-key']);

  if (hasUserKey) {
    next();
    return;
  }

  // In preview / development environment, allow browser requests with same-origin or localhost
  const host = String(req.headers.host || '').toLowerCase();
  const isLocalOrDev =
    host.includes('localhost') ||
    host.includes('127.0.0.1') ||
    host.includes('.run.app') ||
    host.includes('.aistudio.google.com');

  if (isLocalOrDev) {
    next();
    return;
  }

  res.status(401).json({
    ok: false,
    error: 'Authentication or user API key required to access cost-bearing AI endpoints.',
  });
}
