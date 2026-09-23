/** Calendar date stored as `YYYY-MM-DD`, or null when not entered. */
export type IsoDate = string | null;

export type PersonCompany = 'Person' | 'Company';
export type PartFinal = 'Final' | 'Part';
export type YesNo = 'Yes' | 'No';
export type ContinuationCertificate = 'I' | 'II' | 'III' | 'IV';
export type BillStatus = 'Draft' | 'Audited' | 'Paid';

export const BILL_STATUSES: BillStatus[] = ['Draft', 'Audited', 'Paid'];
export const CC_NUMBERS: ContinuationCertificate[] = ['I', 'II', 'III', 'IV'];
export const NOTE_CATEGORIES = ['Observation', 'Finding', 'Exception', 'Compliance', 'Other'] as const;
export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;
export const CONTRACTOR_TYPES = ['Person', 'Company', 'Government Department'] as const;

/** A measured item whose actual quantity exceeded the estimate. */
export interface ExcessItem {
  id: string;
  itemNo: number;
  estimateQty: number;
  actualQty: number;
  unit: string;
  excessQty: number;
}

/** An item that was not in the estimate at all. */
export interface ExtraItem {
  id: string;
  itemNo: number;
  description: string;
  estimateQty: number;
  actualQty: number;
  rate: number;
  amount: number;
}

export interface AuditNote {
  id: string;
  category: string;
  riskLevel: string;
  description: string;
  status: 'Open' | 'Closed';
  auditDate: string;
}

/** The inputs the deduction rules depend on. */
export interface CalculationInput {
  personCompany: PersonCompany | string;
  partFinal: PartFinal | string;
  fine: YesNo | string;
  pac: number;
  baseAmount: number;
  billAmount: number;
  electricityCharges: number;
  documentDate?: IsoDate;
  actualDocumentDate?: IsoDate;
  workOrderDate?: IsoDate;
  agreementDate?: IsoDate;
}

export interface AuditCalculation {
  pac: number;
  ba: number;
  billAmount: number;
  baseAmount: number;
  bv: number;
  nlc: string;
  /** Days between scheduled and actual completion. */
  days: number;
  /** Days between work order and agreement. */
  delay: number;
  gst: number;
  it: number;
  wwc: number;
  wwcCollectionCharge: number;
  wwcCessToBoard: number;
  retention: number;
  /** Fine for delayed completion. */
  fine: number;
  /** Fine for delayed execution of agreement. */
  fineagr: number;
  /** Total deductions. */
  dwoit: number;
  /** Net payable. */
  wit: number;
  eh: number;
  cheque: number;
  billAmountInWords: string;
  netPayableInWords: string;
}

export interface Bill extends CalculationInput {
  /** Primary key; always equal to the bill register number. */
  agno: string;
  billRegisterNo: string;
  auditEnfacementSheetNo: string;
  paymentRegisterNo: string;
  billDate: IsoDate;
  status: BillStatus;

  contractorId: string | null;
  /** Snapshot of the contractor at save time, so reports stay stable if master data changes. */
  contractorName: string;
  contractorAddress: string;
  contractorGstNo: string;
  contractorPanNo: string;

  budgetId: string | null;
  budgetCode: string;
  headOfAccountLabel: string;

  section: string;
  nameOfWork: string;
  workOrderNo: string;
  agreementNo: string;
  esasNo: string;
  esasDate: IsoDate;
  tsqsNo: string;
  tsqsDate: IsoDate;

  workOrderDate: IsoDate;
  agreementDate: IsoDate;
  /** Date of completion as per agreement. */
  documentDate: IsoDate;
  actualDocumentDate: IsoDate;
  measurementByAE: IsoDate;
  measurementByAEE: IsoDate;

  ccn: ContinuationCertificate | string;
  nlcReceived: YesNo | string;
  mbookNumbers: string;
  pages: string;

  gstAt18Percent: number;
  uptoDateBillAmount: number;
  estimateAmount: number;

  extraItemCount: number;
  excessItems: ExcessItem[];
  extraItems: ExtraItem[];
  notes: AuditNote[];

  calculations: AuditCalculation;
  updatedAt: string;
}

export interface Contractor {
  id: string;
  name: string;
  entityType: string;
  address: string;
  gstNo: string;
  panNo: string;
  phone: string;
  email: string;
  isActive: boolean;
  updatedAt: string;
}

export interface Budget {
  id: string;
  code: string;
  headOfAccount: string;
  allocation: number;
  balance: number;
  fiscalYear: string;
  isActive: boolean;
  updatedAt: string;
}
