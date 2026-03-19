import type { NextRequest } from 'next/server';
import type { UserRole } from './types';

export const SESSION_COOKIE = 'rq_v3_session';

// Simple signed session: base64(JSON) — sufficient for demo/dev
// Production would use proper JWT with secret signing

interface SessionPayload {
  userId: string;
  role: UserRole;
  exp: number; // unix timestamp seconds
}

const SESSION_DURATION_SECONDS = 60 * 60 * 8; // 8 hours

export function createSession(role: UserRole, userId: string): string {
  const payload: SessionPayload = {
    userId,
    role,
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function parseSession(token: string): { userId: string; role: UserRole } | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const payload = JSON.parse(decoded) as SessionPayload;

    // Validate required fields
    if (!payload.userId || !payload.role || !payload.exp) {
      return null;
    }

    // Check expiry
    if (Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }

    // Validate role
    const validRoles: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'LECTOR'];
    if (!validRoles.includes(payload.role)) {
      return null;
    }

    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: NextRequest): { userId: string; role: UserRole } | null {
  const cookie = req.cookies.get(SESSION_COOKIE);
  if (!cookie?.value) return null;
  return parseSession(cookie.value);
}

export function canWrite(role: UserRole): boolean {
  return role !== 'LECTOR';
}

export function isAdminOrAbove(role: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}

// Helper to extract session from standard cookie header (for API routes using cookies())
export function parseSessionFromCookieString(cookieHeader: string | null): { userId: string; role: UserRole } | null {
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), v.join('=').trim()];
    })
  );
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  return parseSession(token);
}
