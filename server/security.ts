import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { NextFunction, Request, Response } from 'express';
import { sqlite } from './db';

const FIREBASE_PROJECT_ID = 'clever-catcher-p09p9';
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  const secretFile = path.join(process.cwd(), 'data', '.session_secret');
  if (fs.existsSync(secretFile)) {
    return fs.readFileSync(secretFile, 'utf8').trim();
  }
  const generated = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(secretFile, generated, { mode: 0o600 });
  return generated;
}

const SESSION_SECRET = getSessionSecret();

export function getAdminEmail(): string {
  return (process.env.ADMIN_EMAIL || 'anifranciscaomeje@gmail.com').toLowerCase().trim();
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.startsWith('scrypt:')) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 3) return false;
  const [, salt, hashHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hashHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function generateNumericOtp(digits = 6): string {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits);
  return String(crypto.randomInt(min, max));
}

export function hashOtp(code: string, scope: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(`${scope}:${code.trim()}`).digest('hex');
}

export function verifyOtpHash(code: string, scope: string, storedHash: string): boolean {
  const computed = Buffer.from(hashOtp(code, scope), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (computed.length !== stored.length) return false;
  return crypto.timingSafeEqual(computed, stored);
}

export interface SessionPayload {
  uid: string;
  email: string;
  role: 'user' | 'admin';
  exp: number;
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>, ttlSeconds = 60 * 60 * 24 * 7): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.uid || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function verifyFirebaseIdToken(idToken: string): Promise<{ uid: string; email: string; name?: string; emailVerified?: boolean } | null> {
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    if (!payload.sub || typeof payload.email !== 'string') return null;
    return {
      uid: payload.sub,
      email: payload.email.toLowerCase(),
      name: typeof payload.name === 'string' ? payload.name : undefined,
      emailVerified: Boolean(payload.email_verified),
    };
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email: string;
    role: 'user' | 'admin';
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ status: false, message: 'Authentication required. Please sign in.' });
  }

  const session = verifySessionToken(token);
  if (session) {
    const userRow = sqlite.prepare('SELECT id, email, role FROM users_auth WHERE id = ?').get(session.uid) as
      | { id: string; email: string; role: string }
      | undefined;
    if (!userRow) {
      return res.status(401).json({ status: false, message: 'Session user no longer exists.' });
    }
    const effectiveRole =
      userRow.email.toLowerCase() === getAdminEmail() || userRow.role === 'admin' ? 'admin' : 'user';
    req.authUser = { uid: userRow.id, email: userRow.email, role: effectiveRole };
    return next();
  }

  // Optional Firebase ID token support
  const fb = await verifyFirebaseIdToken(token);
  if (fb) {
    const effectiveRole = fb.email === getAdminEmail() ? 'admin' : 'user';
    req.authUser = { uid: fb.uid, email: fb.email, role: effectiveRole };
    return next();
  }

  return res.status(401).json({ status: false, message: 'Invalid or expired authentication session.' });
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ status: false, message: 'Authentication required.' });
  }
  if (req.authUser.role !== 'admin' && req.authUser.email.toLowerCase() !== getAdminEmail()) {
    return res.status(403).json({ status: false, message: 'Restricted: Owner administrator privileges required.' });
  }
  return next();
}
