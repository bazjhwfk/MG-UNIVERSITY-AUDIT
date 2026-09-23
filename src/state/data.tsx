import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as store from '../data/db';
import type { Snapshot } from '../data/db';
import type { Bill, Budget, Contractor } from '../domain/types';

interface DataApi extends Snapshot {
  ready: boolean;
  error: string | null;
  /** Saves a bill. `previousKey` is the register number it was loaded with, if any. */
  saveBill(bill: Bill, previousKey?: string): Promise<void>;
  deleteBill(agno: string): Promise<void>;
  saveContractor(contractor: Contractor): Promise<void>;
  deleteContractor(id: string): Promise<void>;
  saveBudget(budget: Budget): Promise<void>;
  deleteBudget(id: string): Promise<void>;
  importSnapshot(snapshot: Snapshot): Promise<void>;
  eraseAll(): Promise<void>;
}

const DataContext = createContext<DataApi | null>(null);

const byName = (a: Contractor, b: Contractor) => a.name.localeCompare(b.name);
const byCode = (a: Budget, b: Budget) => a.code.localeCompare(b.code);
const byUpdated = (a: Bill, b: Bill) => b.updatedAt.localeCompare(a.updatedAt);
const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function DataProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ bills: [], contractors: [], budgets: [] });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await store.loadAll();
    setSnapshot({ bills: data.bills.sort(byUpdated), contractors: data.contractors.sort(byName), budgets: data.budgets.sort(byCode) });
  }, []);

  useEffect(() => {
    reload()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setReady(true));
    // Ask the browser not to evict our data under storage pressure.
    navigator.storage?.persist?.().catch(() => undefined);
  }, [reload]);

  const api = useMemo<DataApi>(() => ({
    ...snapshot,
    ready,
    error,
    async saveBill(bill, previousKey) {
      if (!bill.agno) throw new Error('Bill register number is required.');
      if (bill.agno !== previousKey && snapshot.bills.some((b) => b.agno === bill.agno)) {
        throw new Error(`A bill with register number ${bill.agno} already exists.`);
      }
      await store.putBill(bill, previousKey);
      setSnapshot((s) => ({ ...s, bills: [bill, ...s.bills.filter((b) => b.agno !== bill.agno && b.agno !== previousKey)] }));
    },
    async deleteBill(agno) {
      await store.deleteBill(agno);
      setSnapshot((s) => ({ ...s, bills: s.bills.filter((b) => b.agno !== agno) }));
    },
    async saveContractor(contractor) {
      if (!contractor.name.trim()) throw new Error('Contractor name is required.');
      if (snapshot.contractors.some((c) => c.id !== contractor.id && sameText(c.name, contractor.name))) {
        throw new Error(`A contractor named ${contractor.name.trim()} already exists.`);
      }
      const next = { ...contractor, name: contractor.name.trim(), updatedAt: new Date().toISOString() };
      await store.putContractor(next);
      setSnapshot((s) => ({ ...s, contractors: [...s.contractors.filter((c) => c.id !== next.id), next].sort(byName) }));
    },
    async deleteContractor(id) {
      await store.deleteContractor(id);
      setSnapshot((s) => ({ ...s, contractors: s.contractors.filter((c) => c.id !== id) }));
    },
    async saveBudget(budget) {
      if (!budget.code.trim()) throw new Error('Budget code is required.');
      if (snapshot.budgets.some((b) => b.id !== budget.id && sameText(b.code, budget.code))) {
        throw new Error(`Budget code ${budget.code.trim()} already exists.`);
      }
      const next = { ...budget, code: budget.code.trim(), updatedAt: new Date().toISOString() };
      await store.putBudget(next);
      setSnapshot((s) => ({ ...s, budgets: [...s.budgets.filter((b) => b.id !== next.id), next].sort(byCode) }));
    },
    async deleteBudget(id) {
      await store.deleteBudget(id);
      setSnapshot((s) => ({ ...s, budgets: s.budgets.filter((b) => b.id !== id) }));
    },
    async importSnapshot(data) {
      await store.putMany(data);
      await reload();
    },
    async eraseAll() {
      await store.clearAll();
      await reload();
    },
  }), [snapshot, ready, error, reload]);

  return <DataContext.Provider value={api}>{children}</DataContext.Provider>;
}

export function useData(): DataApi {
  const api = useContext(DataContext);
  if (!api) throw new Error('useData must be used inside DataProvider');
  return api;
}
