import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { emptyBill } from '../domain/bill';
import { calculate } from '../domain/calculator';
import type { Bill, Budget, Contractor } from '../domain/types';
import { mergeDbFiles, type DbFile, type Tombstone, type TombstoneType } from './merge';

interface AuditDb extends DBSchema {
  bills: { key: string; value: Bill };
  contractors: { key: string; value: Contractor };
  budgets: { key: string; value: Budget };
  /** Records deleted on this computer, so the GitHub sync doesn't bring them back. */
  tombstones: { key: string; value: Tombstone };
}

export interface Snapshot {
  bills: Bill[];
  contractors: Contractor[];
  budgets: Budget[];
}

const STORES = ['bills', 'contractors', 'budgets', 'tombstones'] as const;

/**
 * Current database. It has its own name because earlier builds used
 * 'bill-audit', whose version upgrade could be held up indefinitely by an old
 * tab left open; a new name can't be blocked by those tabs.
 */
const DB_NAME = 'bill-audit-data';
const LEGACY_DB_NAME = 'bill-audit';
const MIGRATED_KEY = 'bill-audit:legacy-migrated';

let connection: Promise<IDBPDatabase<AuditDb>> | null = null;
let onBlocked: () => void = () => undefined;

/** Called when another tab is holding up a database upgrade. */
export function setBlockedHandler(handler: () => void): void {
  onBlocked = handler;
}

function db(): Promise<IDBPDatabase<AuditDb>> {
  connection ??= openDB<AuditDb>(DB_NAME, 1, {
    upgrade(database) {
      for (const store of STORES) database.createObjectStore(store, { keyPath: store === 'bills' ? 'agno' : 'id' });
    },
    blocked() {
      onBlocked();
    },
    // A newer version opened in another tab: let go so its upgrade isn't stuck behind this tab.
    blocking() {
      void connection?.then((open) => open.close());
      connection = null;
    },
  }).then(async (open) => {
    await migrateLegacy(open);
    return open;
  });
  return connection;
}

/** Fills fields that bills saved by earlier builds may lack, and recalculates. */
function normalizeBill(raw: Partial<Bill>): Bill {
  const bill = { ...emptyBill(), ...raw, updatedAt: raw.updatedAt ?? '' } as Bill;
  return { ...bill, calculations: calculate(bill) };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

/** Reads every store of the earlier 'bill-audit' database, at whatever version it is (no upgrade). */
function readLegacy(): Promise<Partial<DbFile> | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open(LEGACY_DB_NAME);
    request.onerror = () => resolve(null);
    request.onupgradeneeded = () => {
      // It didn't exist: nothing to migrate. Abort so we don't leave an empty database behind.
      request.transaction?.abort();
      resolve({});
    };
    request.onsuccess = () => {
      const legacy = request.result;
      const names = STORES.filter((s) => legacy.objectStoreNames.contains(s));
      if (names.length === 0) { legacy.close(); resolve({}); return; }
      const tx = legacy.transaction(names, 'readonly');
      const out: Record<string, unknown[]> = {};
      for (const name of names) {
        const get = tx.objectStore(name).getAll();
        get.onsuccess = () => { out[name === 'tombstones' ? 'deleted' : name] = get.result; };
      }
      tx.oncomplete = () => { legacy.close(); resolve(out as Partial<DbFile>); };
      tx.onerror = () => { legacy.close(); resolve(null); };
    };
  });
}

/**
 * Copies bills from the earlier database once. If that database is stuck
 * behind an old tab, skip it for now (bills also come from GitHub) and retry
 * on the next start.
 */
async function migrateLegacy(open: IDBPDatabase<AuditDb>): Promise<void> {
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return;
  } catch {
    return;
  }
  const legacy = await withTimeout(readLegacy(), 2500);
  if (!legacy) return;
  const tx = open.transaction([...STORES], 'readwrite');
  const [bills, contractors, budgets, deleted] = await Promise.all([
    tx.objectStore('bills').getAll(),
    tx.objectStore('contractors').getAll(),
    tx.objectStore('budgets').getAll(),
    tx.objectStore('tombstones').getAll(),
  ]);
  const merged = mergeDbFiles(
    { bills, contractors, budgets, deleted },
    { bills: (legacy.bills ?? []).map(normalizeBill), contractors: legacy.contractors ?? [], budgets: legacy.budgets ?? [], deleted: legacy.deleted ?? [] },
  );
  await Promise.all([
    ...merged.bills.map((r) => tx.objectStore('bills').put(r)),
    ...merged.contractors.map((r) => tx.objectStore('contractors').put(r)),
    ...merged.budgets.map((r) => tx.objectStore('budgets').put(r)),
    ...merged.deleted.map((r) => tx.objectStore('tombstones').put(r)),
  ]);
  await tx.done;
  try {
    localStorage.setItem(MIGRATED_KEY, new Date().toISOString());
  } catch {
    // Will simply migrate again next time; merging makes that harmless.
  }
}

const tombstone = (type: TombstoneType, key: string): Tombstone => ({ id: `${type}:${key}`, type, key, at: new Date().toISOString() });

export async function loadAll(): Promise<DbFile> {
  const database = await db();
  const [bills, contractors, budgets, deleted] = await Promise.all([
    database.getAll('bills'),
    database.getAll('contractors'),
    database.getAll('budgets'),
    database.getAll('tombstones'),
  ]);
  return { bills, contractors, budgets, deleted };
}

/** Saves a bill; when the register number changed, the old record is removed in the same transaction. */
export async function putBill(bill: Bill, previousKey?: string): Promise<void> {
  const tx = (await db()).transaction(['bills', 'tombstones'], 'readwrite');
  if (previousKey && previousKey !== bill.agno) {
    await tx.objectStore('bills').delete(previousKey);
    await tx.objectStore('tombstones').put(tombstone('bill', previousKey));
  }
  await tx.objectStore('bills').put(bill);
  await tx.done;
}

async function remove(store: 'bills' | 'contractors' | 'budgets', type: TombstoneType, key: string): Promise<void> {
  const tx = (await db()).transaction([store, 'tombstones'], 'readwrite');
  await tx.objectStore(store).delete(key);
  await tx.objectStore('tombstones').put(tombstone(type, key));
  await tx.done;
}

export const deleteBill = (agno: string) => remove('bills', 'bill', agno);
export const deleteContractor = (id: string) => remove('contractors', 'contractor', id);
export const deleteBudget = (id: string) => remove('budgets', 'budget', id);

export async function putContractor(contractor: Contractor): Promise<void> {
  await (await db()).put('contractors', contractor);
}

export async function putBudget(budget: Budget): Promise<void> {
  await (await db()).put('budgets', budget);
}

/** Upserts every record in one transaction, so a failed import changes nothing. */
export async function putMany(snapshot: Snapshot): Promise<void> {
  const tx = (await db()).transaction(['bills', 'contractors', 'budgets'], 'readwrite');
  await Promise.all([
    ...snapshot.bills.map((bill) => tx.objectStore('bills').put(bill)),
    ...snapshot.contractors.map((contractor) => tx.objectStore('contractors').put(contractor)),
    ...snapshot.budgets.map((budget) => tx.objectStore('budgets').put(budget)),
  ]);
  await tx.done;
}

/**
 * Stores the result of a GitHub sync. It is merged again with whatever is in
 * the database right now, inside one transaction, so edits made while the
 * sync was in flight are kept rather than overwritten.
 */
export async function applySynced(synced: DbFile): Promise<void> {
  const tx = (await db()).transaction([...STORES], 'readwrite');
  const [bills, contractors, budgets, deleted] = await Promise.all([
    tx.objectStore('bills').getAll(),
    tx.objectStore('contractors').getAll(),
    tx.objectStore('budgets').getAll(),
    tx.objectStore('tombstones').getAll(),
  ]);
  const merged = mergeDbFiles({ bills, contractors, budgets, deleted }, synced);
  await Promise.all(STORES.map((store) => tx.objectStore(store).clear()));
  await Promise.all([
    ...merged.bills.map((r) => tx.objectStore('bills').put(r)),
    ...merged.contractors.map((r) => tx.objectStore('contractors').put(r)),
    ...merged.budgets.map((r) => tx.objectStore('budgets').put(r)),
    ...merged.deleted.map((r) => tx.objectStore('tombstones').put(r)),
  ]);
  await tx.done;
}

export async function clearAll(): Promise<void> {
  const tx = (await db()).transaction([...STORES], 'readwrite');
  await Promise.all(STORES.map((store) => tx.objectStore(store).clear()));
  await tx.done;
}
