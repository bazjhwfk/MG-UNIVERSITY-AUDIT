import type { IsoDate } from './types';

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parts(value: IsoDate | undefined): [number, number, number] | null {
  const match = value ? ISO.exec(value) : null;
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** Whole days from `start` to `end`; 0 when either date is missing. */
export function daysBetween(start: IsoDate | undefined, end: IsoDate | undefined): number {
  const a = parts(start);
  const b = parts(end);
  if (!a || !b) return 0;
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86_400_000);
}

/** `dd-MM-yyyy`, the format used on every printed form. */
export function formatDate(value: IsoDate | undefined): string {
  const p = parts(value);
  return p ? `${String(p[2]).padStart(2, '0')}-${String(p[1]).padStart(2, '0')}-${p[0]}` : '';
}

/** e.g. `September 2026`. */
export function monthYear(value: IsoDate | undefined): string {
  const p = parts(value);
  return p ? `${MONTHS[p[1] - 1]} ${p[0]}` : '';
}

/** Indian fiscal year (April–March) containing the date, e.g. `2026-2027`. */
export function fiscalYear(value: IsoDate | undefined): string | null {
  const p = parts(value);
  if (!p) return null;
  const start = p[1] >= 4 ? p[0] : p[0] - 1;
  return `${start}-${start + 1}`;
}

export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
