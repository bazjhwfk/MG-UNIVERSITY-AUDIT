import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/golden.json';
import { toIndianWords } from './amountWords';
import { calculate, gstAt18Percent } from './calculator';
import { daysBetween, fiscalYear, formatDate, monthYear } from './dates';
import type { CalculationInput } from './types';

// golden.json was produced by running these inputs through the desktop app's
// compiled NativeAudit.Shared.dll, so the web port must match it exactly.
describe('calculate() matches the desktop C# calculator', () => {
  for (const { input, expected } of golden.calculations) {
    it(input.name, () => {
      const actual = calculate(input as unknown as CalculationInput) as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(expected)) {
        // Decimals were exported as strings to avoid float drift in the JSON.
        const want = typeof value === 'string' && Number.isNaN(Number(value)) ? value : Number(value);
        expect(actual[key], key).toEqual(want);
      }
    });
  }
});

describe('toIndianWords() matches the desktop C# implementation', () => {
  for (const { amount, expected } of golden.amountWords) {
    it(amount, () => expect(toIndianWords(amount)).toBe(expected));
  }
});

describe('dates', () => {
  it('counts days across month and leap-year boundaries', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2026-03-10', '2026-03-01')).toBe(-9);
    expect(daysBetween(null, '2026-03-01')).toBe(0);
  });
  it('formats for printed forms', () => {
    expect(formatDate('2026-09-03')).toBe('03-09-2026');
    expect(formatDate(null)).toBe('');
    expect(monthYear('2026-09-03')).toBe('September 2026');
  });
  it('derives the April–March fiscal year', () => {
    expect(fiscalYear('2026-03-31')).toBe('2025-2026');
    expect(fiscalYear('2026-04-01')).toBe('2026-2027');
  });
});

it('pre-fills GST at 18% rounded to paise', () => {
  expect(gstAt18Percent(123456.78)).toBe(22222.22);
  expect(gstAt18Percent(-10)).toBe(0);
});
