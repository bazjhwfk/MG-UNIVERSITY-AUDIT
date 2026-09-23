import type { Bill, Budget, Contractor } from '../domain/types';

export type TombstoneType = 'bill' | 'contractor' | 'budget';

/** Marks a record as deleted at a point in time. */
export interface Tombstone {
  id: string; // `${type}:${key}`
  type: TombstoneType;
  key: string;
  at: string;
}

/** Everything stored locally and in the GitHub database file. */
export interface DbFile {
  bills: Bill[];
  contractors: Contractor[];
  budgets: Budget[];
  deleted: Tombstone[];
}

function mergeRecords<T extends { updatedAt: string }>(
  type: TombstoneType, a: T[], b: T[], key: (record: T) => string, tombstones: Map<string, Tombstone>,
): T[] {
  const byKey = new Map<string, T>();
  for (const record of [...a, ...b]) {
    const current = byKey.get(key(record));
    if (!current || (record.updatedAt || '') > (current.updatedAt || '')) byKey.set(key(record), record);
  }
  // A deletion wins unless the record was saved again after it.
  return [...byKey.values()]
    .filter((record) => {
      const deleted = tombstones.get(`${type}:${key(record)}`);
      return !deleted || (record.updatedAt || '') > deleted.at;
    })
    .sort((x, y) => key(x).localeCompare(key(y)));
}

/**
 * Combines two copies record by record: the most recently saved version of
 * each record wins, and deletions from either side are respected.
 */
export function mergeDbFiles(a: DbFile, b: DbFile): DbFile {
  const tombstones = new Map<string, Tombstone>();
  for (const t of [...a.deleted, ...b.deleted]) {
    const current = tombstones.get(t.id);
    if (!current || t.at > current.at) tombstones.set(t.id, t);
  }
  return {
    bills: mergeRecords('bill', a.bills, b.bills, (r) => r.agno, tombstones),
    contractors: mergeRecords('contractor', a.contractors, b.contractors, (r) => r.id, tombstones),
    budgets: mergeRecords('budget', a.budgets, b.budgets, (r) => r.id, tombstones),
    deleted: [...tombstones.values()].sort((x, y) => x.id.localeCompare(y.id)),
  };
}

/** Stable text form used for the GitHub file, so unchanged data produces no commit. */
export function serializeDbFile(file: DbFile): string {
  const sorted = mergeDbFiles(file, { bills: [], contractors: [], budgets: [], deleted: [] });
  return JSON.stringify({ format: 'bill-audit-backup', version: 1, ...sorted }, null, 2) + '\n';
}
