import { emptyBill } from './bill';
import { calculate } from './calculator';
import type { Bill, Budget, Contractor } from './types';

/**
 * Sample data that exercises every deduction rule. One bill cannot hit every
 * rule (retention only applies to Part bills, the weekly and agreement fines
 * only to Final bills), so TEST/01 carries the maximum a Final bill can and
 * the others cover the remaining conditions and boundaries.
 * Expected amounts are asserted in testBills.test.ts.
 */
const STAMP = '2026-09-23T00:00:00.000Z';

export const TEST_CONTRACTORS: Contractor[] = [
  { id: 'test-c1', name: 'Sree Constructions Pvt Ltd', entityType: 'Company', address: 'Gandhinagar, Kottayam', gstNo: '32ABCFS1234K1Z5', panNo: 'ABCFS1234K', phone: '0481 2598000', email: 'accounts@sreeconstructions.example', isActive: true, updatedAt: STAMP },
  { id: 'test-c2', name: 'K. Thomas', entityType: 'Person', address: 'Ettumanoor, Kottayam', gstNo: '', panNo: 'AAAPT1234K', phone: '94470 00000', email: '', isActive: true, updatedAt: STAMP },
  { id: 'test-c3', name: 'Kerala State Electricity Board', entityType: 'Government Department', address: 'Athirampuzha Section', gstNo: '32AAACK1234L1ZN', panNo: 'AAACK1234L', phone: '0481 2730000', email: '', isActive: true, updatedAt: STAMP },
];

export const TEST_BUDGETS: Budget[] = [
  { id: 'test-b1', code: 'EW-01', headOfAccount: 'Engineering Works – Buildings', allocation: 5000000, balance: 5000000, fiscalYear: '2026-2027', isActive: true, updatedAt: STAMP },
  { id: 'test-b2', code: 'MW-02', headOfAccount: 'Maintenance Works – Campus', allocation: 1500000, balance: 1500000, fiscalYear: '2026-2027', isActive: true, updatedAt: STAMP },
];

function testBill(registerNo: string, contractor: Contractor, budget: Budget, fields: Partial<Bill>): Bill {
  const bill: Bill = {
    ...emptyBill(),
    agno: registerNo,
    billRegisterNo: registerNo,
    contractorId: contractor.id,
    contractorName: contractor.name,
    contractorAddress: contractor.address,
    contractorGstNo: contractor.gstNo,
    contractorPanNo: contractor.panNo,
    personCompany: contractor.entityType === 'Company' ? 'Company' : 'Person',
    budgetId: budget.id,
    budgetCode: budget.code,
    headOfAccountLabel: budget.headOfAccount,
    billDate: '2026-09-15',
    section: 'Civil',
    ...fields,
    updatedAt: STAMP,
  };
  return { ...bill, calculations: calculate(bill) };
}

const [company, person, government] = TEST_CONTRACTORS;
const [buildings, maintenance] = TEST_BUDGETS;

export const TEST_BILLS: Bill[] = [
  // Every condition a Final bill can trigger at once.
  testBill('TEST/01', company, buildings, {
    auditEnfacementSheetNo: 'AES/TEST/01', paymentRegisterNo: 'PR/TEST/01', status: 'Draft',
    nameOfWork: 'TEST – Maximum conditions: construction of examination hall annexe (Final bill, company, all fines)',
    workOrderNo: 'WO/2026/101', workOrderDate: '2026-04-01',
    agreementNo: 'AG/2026/101', agreementDate: '2026-04-20', // 19 days after work order → agreement fine 1% of PAC
    esasNo: 'AS/2026/55', esasDate: '2026-03-10', tsqsNo: 'TS/2026/61', tsqsDate: '2026-03-20',
    documentDate: '2026-08-01', actualDocumentDate: '2026-08-24', // 23 days late → 3 weeks + part week
    measurementByAE: '2026-08-26', measurementByAEE: '2026-08-28',
    ccn: 'II', partFinal: 'Final', fine: 'No', nlcReceived: 'Yes',
    mbookNumbers: 'MB 204', pages: '11-19',
    pac: 1200000, baseAmount: 800000, gstAt18Percent: 144000, billAmount: 0, // bill amount derived: 9,44,000
    estimateAmount: 1250000, uptoDateBillAmount: 350000, electricityCharges: 2500,
    extraItemCount: 2,
    excessItems: [
      { id: 'test-01-e1', itemNo: 4, estimateQty: 120, actualQty: 132.5, unit: 'm3', excessQty: 12.5 },
      { id: 'test-01-e2', itemNo: 9, estimateQty: 450, actualQty: 470, unit: 'm2', excessQty: 20 },
    ],
    extraItems: [
      { id: 'test-01-x1', itemNo: 21, description: 'Parapet wall', estimateQty: 0, actualQty: 18, rate: 950, amount: 17100 },
      { id: 'test-01-x2', itemNo: 22, description: 'Rain water gutter', estimateQty: 0, actualQty: 40, rate: 320, amount: 12800 },
    ],
    notes: [
      { id: 'test-01-n1', category: 'Finding', riskLevel: 'High', description: 'Work completed 23 days after the agreed date; completion fine applied.', status: 'Open', auditDate: '2026-09-16' },
      { id: 'test-01-n2', category: 'Observation', riskLevel: 'Low', description: 'M-book pages 11-19 checked against the bill.', status: 'Closed', auditDate: '2026-09-16' },
    ],
  }),
  // Part bill: retention, part-week fine (charged even on part bills), no agreement fine.
  testBill('TEST/02', person, maintenance, {
    auditEnfacementSheetNo: 'AES/TEST/02', paymentRegisterNo: 'PR/TEST/02', status: 'Audited',
    nameOfWork: 'TEST – Part bill: resurfacing of campus road (retention, part-week fine)',
    workOrderNo: 'WO/2026/102', workOrderDate: '2026-05-01', agreementNo: 'AG/2026/102', agreementDate: '2026-05-21',
    documentDate: '2026-08-01', actualDocumentDate: '2026-08-04',
    ccn: 'I', partFinal: 'Part', pac: 300000, baseAmount: 200000, gstAt18Percent: 36000, billAmount: 236000,
  }),
  // Completion fine above 10% of PAC is replaced by a flat ₹1,00,000.
  testBill('TEST/03', company, buildings, {
    auditEnfacementSheetNo: 'AES/TEST/03', paymentRegisterNo: 'PR/TEST/03', status: 'Paid',
    nameOfWork: 'TEST – Fine cap: 104 days late, fine becomes ₹1,00,000',
    documentDate: '2026-01-01', actualDocumentDate: '2026-04-15',
    pac: 400000, baseAmount: 350000, gstAt18Percent: 63000, billAmount: 413000,
  }),
  // Agreement-delay fine below ₹1,000 is raised to ₹1,000.
  testBill('TEST/04', person, maintenance, {
    auditEnfacementSheetNo: 'AES/TEST/04', paymentRegisterNo: 'PR/TEST/04', status: 'Audited',
    nameOfWork: 'TEST – Minimum agreement fine: 1% of PAC is ₹600, charged ₹1,000',
    workOrderDate: '2026-06-01', agreementDate: '2026-06-20',
    pac: 60000, baseAmount: 50000, gstAt18Percent: 9000, billAmount: 59000,
  }),
  // Fine waiver removes both fines even though both delays apply.
  testBill('TEST/05', company, buildings, {
    auditEnfacementSheetNo: 'AES/TEST/05', paymentRegisterNo: 'PR/TEST/05', status: 'Draft',
    nameOfWork: 'TEST – Fine waiver: both delays present, fines waived',
    workOrderDate: '2026-01-01', agreementDate: '2026-02-01', documentDate: '2026-03-01', actualDocumentDate: '2026-03-20',
    fine: 'Yes', pac: 750000, baseAmount: 500000, gstAt18Percent: 90000, billAmount: 590000,
  }),
  // Early completion (no fine) and base value derived from the bill amount.
  testBill('TEST/06', government, maintenance, {
    auditEnfacementSheetNo: 'AES/TEST/06', paymentRegisterNo: 'PR/TEST/06', status: 'Paid',
    nameOfWork: 'TEST – Completed 9 days early; base value derived from bill amount',
    documentDate: '2026-03-10', actualDocumentDate: '2026-03-01',
    pac: 50000, baseAmount: 0, billAmount: 118000, electricityCharges: 0,
  }),
  // GST applies only above ₹2,50,000, so exactly ₹2,50,000 has none.
  testBill('TEST/07', person, buildings, {
    auditEnfacementSheetNo: 'AES/TEST/07', paymentRegisterNo: 'PR/TEST/07', status: 'Draft',
    nameOfWork: 'TEST – GST threshold: base value exactly ₹2,50,000',
    pac: 300000, baseAmount: 250000, gstAt18Percent: 45000, billAmount: 295000,
  }),
  // Boundaries: exactly 14 days agreement delay (no fine), exactly 7 days late (one week).
  testBill('TEST/08', person, maintenance, {
    auditEnfacementSheetNo: 'AES/TEST/08', paymentRegisterNo: 'PR/TEST/08', status: 'Audited',
    nameOfWork: 'TEST – Boundaries: 14-day agreement delay, exactly one week late',
    workOrderDate: '2026-05-01', agreementDate: '2026-05-15', documentDate: '2026-07-01', actualDocumentDate: '2026-07-08',
    pac: 100000, baseAmount: 80000, gstAt18Percent: 14400, billAmount: 94400,
  }),
];
