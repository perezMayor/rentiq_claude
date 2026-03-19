import fs from 'fs';
import path from 'path';
import type { AuditEvent, AuditAction, UserRole } from './types';

const DATA_DIR = process.env.RENTIQ_DATA_DIR ?? './.rentiq-v3-data';
const AUDIT_FILE = path.join(DATA_DIR, 'audit-log.jsonl');

function ensureAuditFile(): void {
  const dir = path.dirname(AUDIT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(AUDIT_FILE)) {
    fs.writeFileSync(AUDIT_FILE, '', 'utf-8');
  }
}

function generateId(): string {
  return `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function appendEvent(
  event: Omit<AuditEvent, 'id' | 'at'>
): Promise<void> {
  ensureAuditFile();
  const full: AuditEvent = {
    ...event,
    id: generateId(),
    at: new Date().toISOString(),
  };
  const line = JSON.stringify(full) + '\n';
  fs.appendFileSync(AUDIT_FILE, line, 'utf-8');
}

export async function getEvents(limit?: number): Promise<AuditEvent[]> {
  ensureAuditFile();
  const raw = fs.readFileSync(AUDIT_FILE, 'utf-8');
  const all = raw
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => {
      try {
        return JSON.parse(l) as AuditEvent;
      } catch {
        return null;
      }
    })
    .filter((e): e is AuditEvent => e !== null);

  // Build suppression index: eventId → suppress event
  // An AUDIT_SUPPRESS event's entityId is the id of the suppressed event.
  const suppressions = new Map<string, AuditEvent>();
  for (const ev of all) {
    if (ev.action === 'AUDIT_SUPPRESS' && ev.entityId) {
      suppressions.set(ev.entityId, ev);
    }
  }

  // Mark suppressed events — original lines are never modified
  const events = all.map((ev) => {
    const sup = suppressions.get(ev.id);
    if (sup) {
      return {
        ...ev,
        suppressedAt: sup.at,
        suppressedBy: sup.actorId,
        suppressReason: (sup.details as Record<string, string> | undefined)?.reason,
      };
    }
    return ev;
  });

  // Most recent first
  events.reverse();

  if (limit !== undefined && limit > 0) {
    return events.slice(0, limit);
  }
  return events;
}

export async function suppressEvent(
  eventId: string,
  suppressedBy: string,
  reason?: string
): Promise<void> {
  ensureAuditFile();

  // Verify the event exists before suppressing
  const raw = fs.readFileSync(AUDIT_FILE, 'utf-8');
  const exists = raw
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .some((l) => {
      try {
        return (JSON.parse(l) as AuditEvent).id === eventId;
      } catch {
        return false;
      }
    });

  if (!exists) {
    throw new Error(`Audit event not found: ${eventId}`);
  }

  // Append-only: never rewrite the file.
  // The suppress event is the record of suppression — getEvents() crosses them.
  await appendEvent({
    action: 'AUDIT_SUPPRESS' as AuditAction,
    actorId: suppressedBy,
    actorRole: 'SUPER_ADMIN' as UserRole,
    entity: 'AuditEvent',
    entityId: eventId,
    details: { reason: reason ?? '' },
  });
}
