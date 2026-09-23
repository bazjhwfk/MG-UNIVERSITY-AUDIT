// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { emptyBill } from '../domain/bill';
import { calculate } from '../domain/calculator';
import type { Bill } from '../domain/types';
import { buildReportHtml, REPORTS } from './buildReport';

function sampleBill(): Bill {
  const bill: Bill = {
    ...emptyBill(),
    agno: 'BR-101', billRegisterNo: 'BR-101', auditEnfacementSheetNo: 'AES-7', paymentRegisterNo: 'PR-3',
    billDate: '2027-01-15', personCompany: 'Company', partFinal: 'Final', ccn: 'II',
    contractorName: 'Acme Builders', contractorAddress: 'Kottayam', contractorGstNo: '32ABCDE1234F1Z5', contractorPanNo: 'ABCDE1234F',
    budgetCode: 'EW-01', headOfAccountLabel: 'Engineering Works', section: 'Civil', nameOfWork: 'Roof <repair> & paint',
    agreementNo: 'AG-4', agreementDate: '2026-05-02', workOrderNo: 'WO-9', workOrderDate: '2026-04-20',
    esasNo: '', esasDate: '2026-04-01', actualDocumentDate: '2026-12-20', mbookNumbers: 'MB 12', pages: '4-9',
    pac: 500000, baseAmount: 300000, billAmount: 354000, gstAt18Percent: 54000,
    extraItemCount: 2,
    excessItems: [{ id: 'e1', itemNo: 4, estimateQty: 10, actualQty: 12.5, unit: 'm3', excessQty: 2.5 }],
    extraItems: [{ id: 'x1', itemNo: 7, description: 'Parapet', estimateQty: 0, actualQty: 3, rate: 450, amount: 1350 }],
  };
  return { ...bill, calculations: calculate(bill) };
}

const render = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const field = (doc: Document, name: string) => doc.querySelector(`[data-field="${name}"]`)?.textContent;

describe('buildReportHtml', () => {
  it('keeps only the selected form, with styles inlined and scripts removed', () => {
    for (const { id } of REPORTS) {
      const doc = render(buildReportHtml(sampleBill(), id));
      const pages = [...doc.querySelectorAll('section.page')];
      expect(pages.length).toBeGreaterThan(0);
      expect(pages.every((p) => p.getAttribute('data-template') === id)).toBe(true);
      expect(doc.querySelector('script')).toBeNull();
      expect(doc.querySelector('style')?.textContent).toContain('@page');
    }
  });

  it('fills the AES register like the desktop app', () => {
    const doc = render(buildReportHtml(sampleBill(), 'aes-register'));
    expect(doc.querySelector('.doc-title')?.textContent).toBe('AUDIT ENFACEMENT SHEET REGISTER 2026-2027');
    expect(field(doc, 'aesRegisterNo')).toBe('AES-7');
    expect(field(doc, 'aesDate')).toBe('15-01-2027');
    expect(field(doc, 'nameOfContractor')).toBe('Acme Builders - Kottayam');
    expect(field(doc, 'actualDateOfCompletion')).toBe('20-12-2026');
    expect(field(doc, 'itLabel')).toBe('IT (2% of Base Value)');
    expect(field(doc, 'billAmount')).toBe('354,000/- (three lakh fifty four thousand rupees only)');
    expect(field(doc, 'gst')).toBe('6,000/- (six thousand rupees only)');
    expect(field(doc, 'fineOthers')).toBe('0');
  });

  it('fills audit notes, excess quantities and extra item count', () => {
    const doc = render(buildReportHtml(sampleBill(), 'audit-notes'));
    expect(field(doc, 'notesNameOfWork')).toBe('Roof <repair> & paint');
    expect(field(doc, 'notesCcNo')).toBe('C.C. No. II');
    expect(field(doc, 'notesMbookPages')).toBe('MB 12 and 4-9');
    expect(field(doc, 'notesAgreement')).toBe('AG-4 dated 02-05-2026');
    expect(field(doc, 'notesAsPsNo')).toBe('01-04-2026');
    expect(field(doc, 'extraCount')).toBe('3 Nos.');
    // notesDate appears on both audit-note pages.
    expect([...doc.querySelectorAll('[data-field="notesDate"]')].map((el) => el.textContent)).toEqual(['15-01-2027', '15-01-2027']);
    const rows = [...doc.querySelectorAll('tbody[data-extra-items] tr')].map((tr) => [...tr.children].map((td) => td.textContent));
    expect(rows).toEqual([
      ['4', '10 m3', '12.5 m3', '2.5 m3'],
      ['7', '0', '3', '3'],
    ]);
  });

  it('fills contractor GST and PAN on the deduction schedules', () => {
    const doc = render(buildReportHtml(sampleBill(), 'schedule-formats'));
    expect(field(doc, 'scheduleMonth')).toBe('January 2027');
    expect(field(doc, 'scheduleGstNo')).toBe('32ABCDE1234F1Z5');
    expect(field(doc, 'schedulePanNo')).toBe('ABCDE1234F');
    expect(field(doc, 'scheduleBillNo')).toBe('II Final');
  });
});
