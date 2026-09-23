import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Bill, Budget, Contractor } from '../domain/types';

interface AuditDb extends DBSchema {
  bills: { key: string; value: Bill };
  contractors: { key: string; value: Contractor };
  budgets: { key: string; value: Budget };
}

export interface Snapshot {
  bills: Bill[];
  contractors: Contractor[];
  budgets: Budget[];
}

let connection: Promise<IDBPDatabase<AuditDb>> | null = null;

function db(): Promise<IDBPDatabase<AuditDb>> {
  connection ??= openDB<AuditDb>('bill-audit', 1, {
    upgrade(database) {
      database.createObjectStore('bills', { keyPath: 'agno' });
      database.createObjectStore('contractors', { keyPath: 'id' });
      database.createObjectStore('budgets', { keyPath: 'id' });
    },
  });
  return connection;
}

export async function loadAll(): Promise<Snapshot> {
  const database = await db();
  const [bills, contractors, budgets] = await Promise.all([
    database.getAll('bills'),
    database.getAll('contractors'),
    database.getAll('budgets'),
  ]);
  return { bills, contractors, budgets };
}

/** Saves a bill; when the register number changed, the old record is removed in the same transaction. */
export async function putBill(bill: Bill, previousKey?: string): Promise<void> {
  const tx = (await db()).transaction('bills', 'readwrite');
  if (previousKey && previousKey !== bill.agno) await tx.store.delete(previousKey);
  await tx.store.put(bill);
  await tx.done;
}

export async function deleteBill(agno: string): Promise<void> {
  await (await db()).delete('bills', agno);
}

export async function putContractor(contractor: Contractor): Promise<void> {
  await (await db()).put('contractors', contractor);
}

export async function deleteContractor(id: string): Promise<void> {
  await (await db()).delete('contractors', id);
}

export async function putBudget(budget: Budget): Promise<void> {
  await (await db()).put('budgets', budget);
}

export async function deleteBudget(id: string): Promise<void> {
  await (await db()).delete('budgets', id);
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

export async function clearAll(): Promise<void> {
  const tx = (await db()).transaction(['bills', 'contractors', 'budgets'], 'readwrite');
  await Promise.all([tx.objectStore('bills').clear(), tx.objectStore('contractors').clear(), tx.objectStore('budgets').clear()]);
  await tx.done;
}
