import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as store from '../data/db';
import type { Snapshot } from '../data/db';
import { syncWithGitHub } from '../data/github';
import type { Bill, Budget, Contractor } from '../domain/types';

const TOKEN_KEY = 'bill-audit:github-token';

export type SyncState =
  | { kind: 'off' }
  | { kind: 'syncing' }
  | { kind: 'ok'; at: string; readOnly: boolean }
  | { kind: 'error'; message: string };

interface DataApi extends Snapshot {
  ready: boolean;
  error: string | null;
  sync: SyncState;
  hasToken: boolean;
  /** Saves a bill. `previousKey` is the register number it was loaded with, if any. */
  saveBill(bill: Bill, previousKey?: string): Promise<void>;
  deleteBill(agno: string): Promise<void>;
  saveContractor(contractor: Contractor): Promise<void>;
  deleteContractor(id: string): Promise<void>;
  saveBudget(budget: Budget): Promise<void>;
  deleteBudget(id: string): Promise<void>;
  importSnapshot(snapshot: Snapshot): Promise<void>;
  setToken(token: string | null): void;
  syncNow(): Promise<void>;
}

const DataContext = createContext<DataApi | null>(null);

const byName = (a: Contractor, b: Contractor) => a.name.localeCompare(b.name);
const byCode = (a: Budget, b: Budget) => a.code.localeCompare(b.code);
const byUpdated = (a: Bill, b: Bill) => b.updatedAt.localeCompare(a.updatedAt);
const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ bills: [], contractors: [], budgets: [] });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncState>({ kind: 'off' });
  const [token, setTokenState] = useState<string | null>(readToken);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const reload = useCallback(async () => {
    const data = await store.loadAll();
    setSnapshot({ bills: data.bills.sort(byUpdated), contractors: data.contractors.sort(byName), budgets: data.budgets.sort(byCode) });
  }, []);

  // One sync at a time; changes made during a sync trigger one more pass afterwards.
  const running = useRef(false);
  const again = useRef(false);
  const syncNow = useCallback(async () => {
    if (running.current) { again.current = true; return; }
    running.current = true;
    try {
      do {
        again.current = false;
        setSync({ kind: 'syncing' });
        try {
          const { merged } = await syncWithGitHub(await store.loadAll(), tokenRef.current);
          await store.applySynced(merged);
          await reload();
          setSync({ kind: 'ok', at: new Date().toISOString(), readOnly: !tokenRef.current });
        } catch (e) {
          setSync({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
        }
      } while (again.current);
    } finally {
      running.current = false;
    }
  }, [reload]);

  // Batch quick successive edits into a single GitHub commit.
  const timer = useRef<number | undefined>(undefined);
  const scheduleSync = useCallback(() => {
    if (!tokenRef.current) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void syncNow(), 2000);
  }, [syncNow]);

  useEffect(() => {
    store.setBlockedHandler(() => {
      setError('Bill Audit is open in another browser tab with an older version, which is holding up a database update. Close the other Bill Audit tabs, then reload this page.');
      setReady(true);
    });
    // Never sit on the loading screen forever if the browser's database doesn't answer.
    const stall = window.setTimeout(() => {
      setError('The browser’s database is not responding. Close every other Bill Audit tab (or restart the browser), then reload this page.');
      setReady(true);
    }, 10000);
    // Show local data straight away; the GitHub sync runs in the background.
    reload()
      .then(() => {
        window.clearTimeout(stall);
        setError(null);
        setReady(true);
        void syncNow();
      })
      .catch((e: unknown) => {
        window.clearTimeout(stall);
        setError(e instanceof Error ? e.message : String(e));
        setReady(true);
      });
    // Ask the browser not to evict our data under storage pressure.
    navigator.storage?.persist?.().catch(() => undefined);
  }, [reload, syncNow]);

  const api = useMemo<DataApi>(() => ({
    ...snapshot,
    ready,
    error,
    sync,
    hasToken: Boolean(token),
    async saveBill(bill, previousKey) {
      if (!bill.agno) throw new Error('Bill register number is required.');
      if (bill.agno !== previousKey && snapshot.bills.some((b) => b.agno === bill.agno)) {
        throw new Error(`A bill with register number ${bill.agno} already exists.`);
      }
      await store.putBill(bill, previousKey);
      setSnapshot((s) => ({ ...s, bills: [bill, ...s.bills.filter((b) => b.agno !== bill.agno && b.agno !== previousKey)] }));
      scheduleSync();
    },
    async deleteBill(agno) {
      await store.deleteBill(agno);
      setSnapshot((s) => ({ ...s, bills: s.bills.filter((b) => b.agno !== agno) }));
      scheduleSync();
    },
    async saveContractor(contractor) {
      if (!contractor.name.trim()) throw new Error('Contractor name is required.');
      if (snapshot.contractors.some((c) => c.id !== contractor.id && sameText(c.name, contractor.name))) {
        throw new Error(`A contractor named ${contractor.name.trim()} already exists.`);
      }
      const next = { ...contractor, name: contractor.name.trim(), updatedAt: new Date().toISOString() };
      await store.putContractor(next);
      setSnapshot((s) => ({ ...s, contractors: [...s.contractors.filter((c) => c.id !== next.id), next].sort(byName) }));
      scheduleSync();
    },
    async deleteContractor(id) {
      await store.deleteContractor(id);
      setSnapshot((s) => ({ ...s, contractors: s.contractors.filter((c) => c.id !== id) }));
      scheduleSync();
    },
    async saveBudget(budget) {
      if (!budget.code.trim()) throw new Error('Budget code is required.');
      if (snapshot.budgets.some((b) => b.id !== budget.id && sameText(b.code, budget.code))) {
        throw new Error(`Budget code ${budget.code.trim()} already exists.`);
      }
      const next = { ...budget, code: budget.code.trim(), updatedAt: new Date().toISOString() };
      await store.putBudget(next);
      setSnapshot((s) => ({ ...s, budgets: [...s.budgets.filter((b) => b.id !== next.id), next].sort(byCode) }));
      scheduleSync();
    },
    async deleteBudget(id) {
      await store.deleteBudget(id);
      setSnapshot((s) => ({ ...s, budgets: s.budgets.filter((b) => b.id !== id) }));
      scheduleSync();
    },
    async importSnapshot(data) {
      await store.putMany(data);
      await reload();
      scheduleSync();
    },
    setToken(value) {
      const clean = value?.trim() || null;
      try {
        if (clean) localStorage.setItem(TOKEN_KEY, clean);
        else localStorage.removeItem(TOKEN_KEY);
      } catch {
        // Storage blocked: the token only lasts for this session.
      }
      tokenRef.current = clean;
      setTokenState(clean);
      void syncNow();
    },
    syncNow,
  }), [snapshot, ready, error, sync, token, reload, scheduleSync, syncNow]);

  return <DataContext.Provider value={api}>{children}</DataContext.Provider>;
}

export function useData(): DataApi {
  const api = useContext(DataContext);
  if (!api) throw new Error('useData must be used inside DataProvider');
  return api;
}
