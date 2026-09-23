import { describe, expect, it } from 'vitest';
import { TEST_BILLS } from './testBills';

// Hand-worked expected amounts for each sample bill (see comments in testBills.ts).
const EXPECTED: Record<string, Partial<Record<string, number>>> = {
  // 9,44,000 − (fine 48,000 + agreement 12,000 + GST 16,000 + WWC 8,000 + elec 2,500 + IT 16,000)
  'TEST/01': { billAmount: 944000, days: 23, delay: 19, fine: 48000, fineagr: 12000, gst: 16000, it: 16000, wwc: 8000, wwcCessToBoard: 7920, wwcCollectionCharge: 80, retention: 0, dwoit: 102500, wit: 841500 },
  'TEST/02': { days: 3, delay: 20, fine: 3000, fineagr: 0, gst: 0, it: 2000, wwc: 2000, retention: 5000, dwoit: 12000, wit: 224000 },
  'TEST/03': { days: 104, fine: 100000, gst: 7000, it: 7000, wwc: 3500, wit: 295500 },
  'TEST/04': { delay: 19, fineagr: 1000, it: 500, wwc: 500, wit: 57000 },
  'TEST/05': { days: 19, delay: 31, fine: 0, fineagr: 0, gst: 10000, it: 10000, wwc: 5000, wit: 565000 },
  'TEST/06': { days: -9, baseAmount: 100000, fine: 0, it: 1000, wwc: 1000, wit: 116000 },
  'TEST/07': { gst: 0, it: 2500, wwc: 2500, wit: 290000 },
  'TEST/08': { delay: 14, days: 7, fineagr: 0, fine: 1000, it: 800, wwc: 800, wit: 91800 },
};

describe('sample test bills', () => {
  for (const bill of TEST_BILLS) {
    it(`${bill.billRegisterNo} computes the expected deductions`, () => {
      expect(bill.calculations).toMatchObject(EXPECTED[bill.billRegisterNo]);
    });
  }

  it('together cover every rule', () => {
    const c = TEST_BILLS.map((b) => ({ ...b.calculations, bill: b }));
    expect(c.some((x) => x.gst > 0)).toBe(true);
    expect(c.some((x) => x.bill.personCompany === 'Company' && x.it > 0)).toBe(true);
    expect(c.some((x) => x.retention > 0)).toBe(true);
    expect(c.some((x) => x.fine === 100000)).toBe(true);
    expect(c.some((x) => x.fineagr === 1000)).toBe(true);
    expect(c.some((x) => x.bill.fine === 'Yes')).toBe(true);
    expect(c.some((x) => x.bill.baseAmount === 0 && x.baseAmount > 0)).toBe(true);
    expect(c.some((x) => x.bill.billAmount === 0 && x.billAmount > 0)).toBe(true);
    expect(c.some((x) => x.bill.electricityCharges > 0)).toBe(true);
    expect(new Set(TEST_BILLS.map((b) => b.status))).toEqual(new Set(['Draft', 'Audited', 'Paid']));
  });
});
