import { calculate } from './calculator';
import { today } from './dates';
import type { Bill, Budget, Contractor } from './types';

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export function emptyBill(): Bill {
  const bill: Omit<Bill, 'calculations'> = {
    agno: '',
    billRegisterNo: '',
    auditEnfacementSheetNo: '',
    paymentRegisterNo: '',
    billDate: today(),
    status: 'Draft',
    personCompany: 'Person',
    contractorId: null,
    contractorName: '',
    contractorAddress: '',
    contractorGstNo: '',
    contractorPanNo: '',
    budgetId: null,
    budgetCode: '',
    headOfAccountLabel: '',
    section: '',
    nameOfWork: '',
    workOrderNo: '',
    agreementNo: '',
    esasNo: '',
    esasDate: null,
    tsqsNo: '',
    tsqsDate: null,
    workOrderDate: null,
    agreementDate: null,
    documentDate: null,
    actualDocumentDate: null,
    measurementByAE: null,
    measurementByAEE: null,
    ccn: 'I',
    partFinal: 'Final',
    fine: 'No',
    nlcReceived: 'Yes',
    mbookNumbers: '',
    pages: '',
    pac: 0,
    baseAmount: 0,
    gstAt18Percent: 0,
    billAmount: 0,
    uptoDateBillAmount: 0,
    estimateAmount: 0,
    electricityCharges: 0,
    extraItemCount: 0,
    excessItems: [],
    extraItems: [],
    notes: [],
    updatedAt: '',
  };
  return { ...bill, calculations: calculate(bill) };
}

/** Normalises keys, snapshots master data and recalculates before a bill is stored. */
export function finalizeBill(bill: Bill, contractors: Contractor[], budgets: Budget[]): Bill {
  const registerNo = bill.billRegisterNo.trim();
  const contractor = contractors.find((c) => c.id === bill.contractorId);
  const budget = budgets.find((b) => b.id === bill.budgetId);
  const next: Bill = {
    ...bill,
    agno: registerNo,
    billRegisterNo: registerNo,
    ...(contractor && {
      contractorName: contractor.name,
      contractorAddress: contractor.address,
      contractorGstNo: contractor.gstNo,
      contractorPanNo: contractor.panNo,
    }),
    ...(budget && { budgetCode: budget.code, headOfAccountLabel: budget.headOfAccount }),
    extraItems: bill.extraItems.map((item) => ({ ...item, amount: item.actualQty * item.rate })),
    updatedAt: new Date().toISOString(),
  };
  return { ...next, calculations: calculate(next) };
}

/** Total extra items (entered count plus itemised extras), as printed on the audit notes. */
export function extraItemTotal(bill: Bill): number {
  return Math.max(0, bill.extraItemCount) + bill.extraItems.length;
}

export function billMatches(bill: Bill, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [bill.billRegisterNo, bill.contractorName, bill.nameOfWork, bill.workOrderNo, bill.agreementNo, bill.auditEnfacementSheetNo, bill.paymentRegisterNo, bill.section, bill.budgetCode]
    .some((field) => field?.toLowerCase().includes(q));
}
