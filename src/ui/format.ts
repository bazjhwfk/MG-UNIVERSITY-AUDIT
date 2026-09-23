const N0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** Whole-number amount with thousands separators, as the desktop app shows it ("N0"). */
export const number = (value: number): string => N0.format(value);

/** `₹3,54,000` with Indian digit grouping. */
export const rupees = (value: number): string => '₹' + INR.format(value);

/** `₹3.54 L`, `₹1.20 Cr` — short form for dashboard figures. */
export function compactRupees(value: number): string {
  if (Math.abs(value) >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
  if (Math.abs(value) >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
  return rupees(value);
}

export function initials(name: string): string {
  const letters = name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('');
  return (letters.slice(0, 2) || '?').toUpperCase();
}
