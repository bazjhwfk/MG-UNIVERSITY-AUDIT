import { toIndianWords } from '../domain/amountWords';
import { extraItemTotal } from '../domain/bill';
import { roundRupees } from '../domain/calculator';
import { fiscalYear, formatDate, monthYear } from '../domain/dates';
import type { Bill } from '../domain/types';
import templateCss from './print-preview.css?raw';
import templateHtml from './print-preview.html?raw';

export const REPORTS = [
  { id: 'audit-notes', title: 'Audit Notes' },
  { id: 'aes-register', title: 'Audit Enfacement Sheet Register' },
  { id: 'payment-register', title: 'Payment Register' },
  { id: 'schedule-formats', title: 'Direct Service Deduction Schedules' },
  { id: 'audit-enfacement-format', title: 'Note to Finance Officer / Enfacement Format' },
] as const;

export type ReportId = (typeof REPORTS)[number]['id'];

const INVARIANT_GROUPING = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** `1,234/- (one thousand two hundred thirty four rupees only)`, as on the desktop forms. */
function amount(value: number): string {
  const rounded = roundRupees(value);
  return `${INVARIANT_GROUPING.format(rounded)}/- (${toIndianWords(rounded)} only)`;
}

const withDate = (text: string, value: string | null): string =>
  text ? text + (value ? ' dated ' + formatDate(value) : '') : formatDate(value);

function quantity(value: number, unit: string): string {
  const number = String(Math.round(value * 100) / 100);
  return unit.trim() ? `${number} ${unit.trim()}` : number;
}

/** Field values keyed by the template's `data-field` names. */
export function reportFields(bill: Bill): Record<string, string> {
  const c = bill.calculations;
  const date = formatDate;
  const serial = `${bill.ccn ?? ''} ${bill.partFinal ?? ''}`.trim();
  const contractor = [bill.contractorName, bill.contractorAddress].filter(Boolean).join(' - ');
  const headOfAccount = bill.headOfAccountLabel || bill.budgetCode;
  const agreement = bill.agreementNo ? withDate(bill.agreementNo, bill.agreementDate) : '';
  const workOrder = bill.workOrderNo ? withDate(bill.workOrderNo, bill.workOrderDate) : '';
  const mbookPages = [bill.mbookNumbers, bill.pages].filter(Boolean).join(' and ');
  const itLabel = bill.personCompany === 'Company' ? 'IT (2% of Base Value)' : 'IT (1% of Base Value)';
  const month = monthYear(bill.billDate);
  const extras = extraItemTotal(bill);

  // One register block, filled twice: the AES register and the payment register.
  const register = (p: string) => ({
    [p ? 'paymentContractor' : 'nameOfContractor']: contractor,
    [p ? 'paymentWork' : 'nameOfWork']: bill.nameOfWork,
    [p ? 'paymentAgreement' : 'agreementNumber']: bill.agreementNo,
    [p ? 'paymentActualCompletion' : 'actualDateOfCompletion']: date(bill.actualDocumentDate),
    [p ? 'paymentPartFinal' : 'partFinal']: bill.partFinal,
    [p ? 'paymentBillRegisterNo' : 'billRegisterNo']: bill.billRegisterNo,
    [p ? 'paymentHeadOfAccount' : 'headOfAccount']: headOfAccount,
    [p ? 'paymentMBookNo' : 'mBookNo']: bill.mbookNumbers,
    [p ? 'paymentBaseValue' : 'baseValue']: amount(c.baseAmount),
    [p ? 'paymentBillAmount' : 'billAmount']: amount(c.billAmount),
    [p ? 'paymentIt' : 'it']: amount(c.it),
    [p ? 'paymentWwc' : 'wwc']: amount(c.wwc),
    [p ? 'paymentGst' : 'gst']: amount(c.gst),
    [p ? 'paymentRetention' : 'retention']: amount(c.retention),
    [p ? 'paymentECharge' : 'electricityCharges']: amount(bill.electricityCharges),
    [p ? 'paymentFineExec' : 'fineExecution']: amount(c.fineagr),
    [p ? 'paymentFineComp' : 'fineCompletion']: amount(c.fine),
    [p ? 'paymentFineOthers' : 'fineOthers']: '0',
    [p ? 'paymentChequeAmount' : 'chequeAmount']: amount(c.cheque),
    [p ? 'paymentFinalDate' : 'dateOfFinalPayment']: date(bill.billDate),
    [p ? 'paymentSecurityDate' : 'dateSecurityReleased']: date(bill.billDate),
    [p ? 'paymentAllocation' : 'allocation']: '0',
    [p ? 'paymentExpenditure' : 'expenditure']: amount(c.wit),
    [p ? 'paymentBalance' : 'balance']: '0',
    [p ? 'paymentItLabel' : 'itLabel']: itLabel,
  });

  return {
    aesRegisterNo: bill.auditEnfacementSheetNo,
    aesDate: date(bill.billDate),
    ...register(''),
    paymentRegisterNo: bill.paymentRegisterNo,
    paymentDate: date(bill.billDate),
    paymentAesNo: bill.auditEnfacementSheetNo,
    ...register('payment'),

    scheduleMonth: month, scheduleMonth2: month, scheduleMonth3: month,
    scheduleGstNo: bill.contractorGstNo, schedulePanNo: bill.contractorPanNo,
    scheduleContractor: bill.contractorName, scheduleContractor2: bill.contractorName, scheduleContractor3: bill.contractorName,
    scheduleContractorAddress: bill.contractorAddress, scheduleContractorAddress2: bill.contractorAddress, scheduleContractorAddress3: bill.contractorAddress,
    scheduleWork: bill.nameOfWork, scheduleWork2: bill.nameOfWork, scheduleWork3: bill.nameOfWork,
    scheduleAgreement: agreement, scheduleAgreement2: agreement, scheduleAgreement3: agreement,
    scheduleBillNo: serial, scheduleBillNo2: serial, scheduleBillNo3: serial,
    scheduleGrossAmount: amount(c.billAmount), scheduleGrossAmount2: amount(c.billAmount), scheduleGrossAmount3: amount(c.billAmount),
    scheduleGstAmount: amount(c.gst), scheduleItAmount: amount(c.it), scheduleWwcAmount: amount(c.wwc),

    enfNo: bill.workOrderNo, enfSubject: bill.nameOfWork, enfRef1: agreement, enfRef2: workOrder,
    enfBillNo: serial, enfContractorFull: contractor,

    notesSection: bill.section,
    notesNameOfWork: bill.nameOfWork,
    notesContractor: contractor,
    notesBillRegisterNo: bill.billRegisterNo,
    notesCcNo: `C.C. No. ${bill.ccn}`,
    notesMbookPages: mbookPages,
    notesWorkOrder: workOrder,
    notesAgreement: agreement,
    notesEstimateAmount: amount(bill.estimateAmount),
    notesAsPsNo: withDate(bill.esasNo, bill.esasDate),
    notesTsNo: withDate(bill.tsqsNo, bill.tsqsDate),
    notesPac: amount(bill.pac),
    notesBaseValue: amount(c.baseAmount),
    notesGstAt18Percent: amount(bill.gstAt18Percent),
    notesGst: amount(c.gst),
    notesIt: amount(c.it),
    notesWwc: amount(c.wwc),
    notesWwfCessToBoard: amount(c.wwcCessToBoard),
    notesWwfCollectionCharge: amount(c.wwcCollectionCharge),
    notesRetention: amount(c.retention),
    notesFine: amount(c.fine + c.fineagr),
    notesCheque: amount(c.cheque),
    notesSinceLastBill: amount(bill.uptoDateBillAmount),
    notesExpenditure: 'Nil',
    notesMeasureAe: date(bill.measurementByAE),
    notesMeasureAee: date(bill.measurementByAEE),
    notesDoc: date(bill.documentDate),
    notesAdoc: date(bill.actualDocumentDate),
    notesNlc: bill.nlcReceived || 'Yes',
    notesPoa: 'No',
    notesAttachment: 'No',
    notesFunds: headOfAccount,
    notesDate: date(bill.billDate),
    extraCount: extras === 0 ? 'No Extra Items' : extras === 1 ? '1 No.' : `${extras} Nos.`,
  };
}

/** Rows for the "Excess Quantities" table on the audit notes. */
export function excessRows(bill: Bill): string[][] {
  return [
    ...bill.excessItems.filter((item) => item.excessQty > 0).map((item) => ({ ...item, excess: item.excessQty, unit: item.unit })),
    ...bill.extraItems.map((item) => ({ ...item, excess: Math.max(0, item.actualQty - item.estimateQty), unit: '' })).filter((item) => item.excess > 0),
  ].map((item) => [String(item.itemNo), quantity(item.estimateQty, item.unit), quantity(item.actualQty, item.unit), quantity(item.excess, item.unit)]);
}

/** A complete, self-contained HTML document for one printed form. */
export function buildReportHtml(bill: Bill, report: ReportId): string {
  const doc = new DOMParser().parseFromString(templateHtml, 'text/html');
  doc.querySelectorAll('script').forEach((script) => script.remove());
  const style = doc.createElement('style');
  style.textContent = templateCss;
  doc.querySelector('link[rel="stylesheet"]')?.replaceWith(style);
  doc.title = `${REPORTS.find((r) => r.id === report)?.title ?? 'Report'} – ${bill.billRegisterNo}`;

  doc.querySelectorAll<HTMLElement>('section.page').forEach((page) => {
    if (page.dataset.template === report) page.style.setProperty('display', 'block', 'important');
    else page.remove();
  });

  const year = fiscalYear(bill.billDate);
  if (year) {
    doc.querySelectorAll('.doc-title').forEach((title) => {
      title.textContent = (title.textContent ?? '').replace(/\d{4}-\d{4}/, year);
    });
  }

  for (const [field, value] of Object.entries(reportFields(bill))) {
    doc.querySelectorAll(`[data-field="${field}"]`).forEach((el) => {
      el.textContent = value ?? '';
    });
  }

  const tbody = doc.querySelector('tbody[data-extra-items]');
  if (tbody) {
    const rows = excessRows(bill);
    for (const cells of rows.length ? rows : [[' ', ' ', ' ', ' ']]) {
      const tr = tbody.appendChild(doc.createElement('tr'));
      for (const text of cells) tr.appendChild(doc.createElement('td')).textContent = text;
    }
  }

  return '<!doctype html>\n' + doc.documentElement.outerHTML;
}
