import fs from 'fs';
import path from 'path';
import type { RentalStore } from './types';
import { createSeedStore } from './seed';

const DATA_DIR = process.env.RENTIQ_DATA_DIR ?? './.rentiq-v3-data';
const STORE_FILE = path.join(DATA_DIR, 'rental-store.json');
const LOCK_FILE = path.join(DATA_DIR, '.write-lock');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function acquireLock(): void {
  const maxWait = 5000; // 5 seconds
  const pollInterval = 50;
  let waited = 0;

  while (fs.existsSync(LOCK_FILE) && waited < maxWait) {
    const sleepSync = (ms: number) => {
      const start = Date.now();
      while (Date.now() - start < ms) {
        // busy wait — acceptable for file lock
      }
    };
    sleepSync(pollInterval);
    waited += pollInterval;
  }

  // Check if lock is stale (older than 10 seconds)
  if (fs.existsSync(LOCK_FILE)) {
    const stat = fs.statSync(LOCK_FILE);
    const age = Date.now() - stat.mtimeMs;
    if (age < 10000) {
      throw new Error('Could not acquire write lock: another process holds the lock');
    }
  }

  fs.writeFileSync(LOCK_FILE, String(process.pid));
}

function releaseLock(): void {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch {
    // ignore
  }
}

export function readStore(): RentalStore {
  ensureDataDir();
  if (!fs.existsSync(STORE_FILE)) {
    const seed = createSeedStore();
    fs.writeFileSync(STORE_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
  const raw = fs.readFileSync(STORE_FILE, 'utf-8');
  return JSON.parse(raw) as RentalStore;
}

export function writeStore(store: RentalStore): void {
  ensureDataDir();
  store.meta.lastUpdated = new Date().toISOString();
  acquireLock();
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } finally {
    releaseLock();
  }
}

export function withStore<T>(fn: (store: RentalStore) => T): T {
  const store = readStore();
  return fn(store);
}

export function withStoreWrite<T>(fn: (store: RentalStore) => T): T {
  ensureDataDir();
  acquireLock();
  try {
    const store = readStore();
    const result = fn(store);
    store.meta.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
    return result;
  } finally {
    releaseLock();
  }
}

// ─── Typed helpers ────────────────────────────────────────────────────────────

export function getNextReservationNumber(store: RentalStore): string {
  const year = new Date().getFullYear();
  const prefix = `RSV-${year}-`;
  const existing = store.reservations
    .filter((r) => r.number.startsWith(prefix))
    .map((r) => parseInt(r.number.replace(prefix, ''), 10))
    .filter((n) => !isNaN(n));
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  return `${prefix}${String(max + 1).padStart(6, '0')}`;
}

export function getNextContractNumber(store: RentalStore, branchId: string): string {
  const branch = store.branches.find((b) => b.id === branchId);
  if (!branch) throw new Error(`Branch not found: ${branchId}`);
  branch.contractCounter += 1;
  const year = new Date().getFullYear();
  return `${branch.contractPrefix}-${year}-${String(branch.contractCounter).padStart(6, '0')}`;
}

export function getNextInvoiceNumber(store: RentalStore, branchId: string): string {
  const branch = store.branches.find((b) => b.id === branchId);
  if (!branch) throw new Error(`Branch not found: ${branchId}`);
  branch.invoiceCounter += 1;
  const year = new Date().getFullYear();
  const series = store.settings.invoiceSeries ?? 'F';
  return `${series}-${year}-${String(branch.invoiceCounter).padStart(6, '0')}`;
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
