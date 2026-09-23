import { exportBackup, parseBackup } from '../data/backup';
import type { Snapshot } from '../data/db';
import { today } from '../domain/dates';
import { errorMessage } from '../state/session';

/** Downloads every record as one JSON file. */
export function downloadBackup(snapshot: Snapshot): void {
  const url = URL.createObjectURL(new Blob([exportBackup(snapshot)], { type: 'application/json' }));
  Object.assign(document.createElement('a'), { href: url, download: `native-audit-backup-${today()}.json` }).click();
  URL.revokeObjectURL(url);
}

/** Lets the user pick a backup (web or desktop format) and imports it after confirmation. Returns the status message. */
export function restoreBackup(importSnapshot: (s: Snapshot) => Promise<void>): Promise<string | null> {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'application/json,.json' });
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const parsed = parseBackup(await file.text());
        const ok = window.confirm(`Restore ${parsed.bills.length} bill(s), ${parsed.contractors.length} contractor(s) and ${parsed.budgets.length} budget(s)? Bills with the same register number will be replaced.`);
        if (!ok) return resolve(null);
        await importSnapshot(parsed);
        resolve('JSON backup restored.');
      } catch (error) {
        resolve('Restore failed: ' + errorMessage(error));
      }
    };
    input.click();
  });
}
