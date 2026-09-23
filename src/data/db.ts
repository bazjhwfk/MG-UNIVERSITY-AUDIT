import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
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
let connection: Promise<IDBPDatabase<AuditDb>> | null = null;

function db(): Promise<IDBPDatabase<AuditDb>> {
  connection ??= openDB<AuditDb>('bill-audit', 2, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('bills', { keyPath: 'agno' });
        database.createObjectStore('contractors', { keyPath: 'id' });
        database.createObjectStore('budgets', { keyPath: 'id' });
      }
      if (oldVersion < 2) database.createObjectStore('tombstones', { keyPath: 'id' });
    },
  });
  return connection;
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
