import type { Bill } from '../domain/types';
import type { ReportId } from '../reports/buildReport';

/** The bill currently open in the form, shared by every tab (like the desktop app's current work order). */
export interface Session {
  draft: Bill;
  /** Register number the bill was last saved under; undefined for a new bill. */
  savedKey?: string;
  update(changes: Partial<Bill>): void;
  /** Saves `next` (default: the current form) and shows `message` on success. */
  save(next?: Bill, message?: string): Promise<boolean>;
  open(bill: Bill): void;
  clear(): void;
  /** Shows a message in the blue status bar. */
  show(message: string): void;
  print(report: ReportId): void;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
