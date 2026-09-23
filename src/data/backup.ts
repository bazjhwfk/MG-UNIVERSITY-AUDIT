import { emptyBill, newId } from '../domain/bill';
import { calculate } from '../domain/calculator';
import type { AuditNote, Bill, Budget, Contractor, ExcessItem, ExtraItem } from '../domain/types';
import type { Snapshot } from './db';

const FORMAT = 'bill-audit-backup';
const VERSION = 1;

export function exportBackup(snapshot: Snapshot): string {
  return JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), ...snapshot }, null, 2);
}

/**
 * Reads a backup made by this app, or a JSON backup from the Windows desktop
 * app (NativeAudit "Backup JSON"), and returns records ready to store.
 */
export function parseBackup(json: string): Snapshot & { source: 'web' | 'desktop' } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  if (!data || typeof data !== 'object') throw new Error('The file is not a backup.');
  const record = data as Record<string, unknown>;

  if (record.format === FORMAT) {
    if (Number(record.version) > VERSION) throw new Error('This backup was made by a newer version of the app.');
    const bills = asArray(record.bills).map((bill) => {
      const merged = { ...emptyBill(), ...(bill as Partial<Bill>) } as Bill;
      return { ...merged, calculations: calculate(merged) };
    });
    return { source: 'web', bills, contractors: asArray(record.contractors) as Contractor[], budgets: asArray(record.budgets) as Budget[] };
  }
  if ('WorkOrders' in record) return { source: 'desktop', ...fromDesktop(record) };
  throw new Error('The file is not a Bill Audit or NativeAudit backup.');
}

// ---- Desktop (NativeAudit WPF) backup format: PascalCase, Newtonsoft dates ----

type Legacy = Record<string, unknown>;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : String(value));
const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0);
/** `2026-09-09T00:00:00` → `2026-09-09`; the desktop app stores calendar dates without a time zone. */
const date = (value: unknown): string | null => {
  const text = str(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) && !text.startsWith('0001-') ? text.slice(0, 10) : null;
};

function fromDesktop(record: Legacy): Snapshot {
  const contractors = asArray(record.Contractors).map((raw): Contractor => {
    const c = raw as Legacy;
    return {
      id: str(c.Id) || newId(),
      name: str(c.Name).trim(),
      entityType: str(c.EntityType) || 'Person',
      address: str(c.Address),
      gstNo: str(c.GstNo),
      panNo: str(c.PanNo),
      phone: str(c.Phone),
      email: str(c.Email),
      isActive: c.IsActive !== false,
      updatedAt: str(c.UpdatedAtUtc) || new Date().toISOString(),
    };
  });
  const budgets = asArray(record.Budgets).map((raw): Budget => {
    const b = raw as Legacy;
    return {
      id: str(b.Id) || newId(),
      code: str(b.Code).trim(),
      headOfAccount: str(b.HeadOfAccount),
      allocation: num(b.Allocation),
      balance: num(b.Balance),
      fiscalYear: str(b.FiscalYear),
      isActive: b.IsActive !== false,
      updatedAt: str(b.UpdatedAtUtc) || new Date().toISOString(),
    };
  });

  const byBill = new Map<string, { excess: ExcessItem[]; extra: ExtraItem[]; count: number; notes: AuditNote[] }>();
  const detailsFor = (key: string) => {
    if (!byBill.has(key)) byBill.set(key, { excess: [], extra: [], count: 0, notes: [] });
    return byBill.get(key)!;
  };
  for (const raw of asArray(record.ExtraItems)) {
    const item = raw as Legacy;
    const details = detailsFor(str(item.WorkOrderId));
    if (item.IsExtraItem !== true) {
      // Excess-quantity rows. `ExcessQty` is the desktop app's computed value.
      details.excess.push({
        id: str(item.Id) || newId(),
        itemNo: num(item.ItemNo),
        estimateQty: num(item.EstimatedQty),
        actualQty: num(item.ActualQty),
        unit: str(item.Unit),
        excessQty: num(item.ExcessQty ?? item.ExcessQuantity),
      });
    } else if (str(item.Description) || num(item.Rate) || num(item.ActualQty) || num(item.EstimatedQty) || num(item.ItemNo)) {
      details.extra.push({
        id: str(item.Id) || newId(),
        itemNo: num(item.ItemNo),
        description: str(item.Description),
        estimateQty: num(item.EstimatedQty),
        actualQty: num(item.ActualQty),
        rate: num(item.Rate),
        amount: num(item.Amount),
      });
    } else {
      // "Extra items (Nos.)" entries only carry a count.
      details.count += Math.max(0, num(item.ExtraCount));
    }
  }
  for (const raw of asArray(record.AuditNotes)) {
    const note = raw as Legacy;
    detailsFor(str(note.WorkOrderId)).notes.push({
      id: str(note.Id) || newId(),
      category: str(note.Category) || 'Observation',
      riskLevel: str(note.RiskLevel) || 'Medium',
      description: str(note.Description),
      status: str(note.Status) === 'Closed' ? 'Closed' : 'Open',
      auditDate: date(note.AuditDate) ?? date(note.UpdatedAtUtc) ?? '',
    });
  }

  const bills = asArray(record.WorkOrders).map((raw): Bill => {
    const w = raw as Legacy;
    const agno = str(w.Agno || w.BillRegisterNo).trim();
    const details = byBill.get(agno) ?? { excess: [], extra: [], count: 0, notes: [] };
    const contractor = contractors.find((c) => c.id === str(w.ContractorId));
    const status = str(w.Status);
    const bill: Bill = {
      ...emptyBill(),
      agno,
      billRegisterNo: str(w.BillRegisterNo).trim() || agno,
      auditEnfacementSheetNo: str(w.AuditEnfacementSheetNo),
      paymentRegisterNo: str(w.PaymentRegisterNo),
      billDate: date(w.BillDate),
      status: status === 'Audited' || status === 'Paid' ? status : 'Draft',
      personCompany: str(w.PersonCompany) || 'Person',
      contractorId: str(w.ContractorId) || null,
      contractorName: str(w.ContractorName) || contractor?.name || '',
      contractorAddress: contractor?.address ?? '',
      contractorGstNo: contractor?.gstNo ?? '',
      contractorPanNo: contractor?.panNo ?? '',
      budgetId: str(w.BudgetId) || null,
      budgetCode: str(w.BudgetCode),
      headOfAccountLabel: str(w.HeadOfAccountLabel),
      section: str(w.Section),
      nameOfWork: str(w.NameOfWork),
      workOrderNo: str(w.WorkOrderNo),
      agreementNo: str(w.AgreementNo),
      esasNo: str(w.EsasNo),
      esasDate: date(w.EsasDate),
      tsqsNo: str(w.TsqsNo),
      tsqsDate: date(w.TsqsDate),
      workOrderDate: date(w.WorkOrderDate ?? w.Wod),
      agreementDate: date(w.AgreementDate ?? w.Agdate),
      documentDate: date(w.DocumentDate ?? w.Doc),
      actualDocumentDate: date(w.ActualDocumentDate ?? w.Adoc ?? w.ActualDateOfCompletion),
      measurementByAE: date(w.MeasurementByAE),
      measurementByAEE: date(w.MeasurementByAEE),
      ccn: str(w.Ccn || w.Cc) || 'I',
      partFinal: str(w.PartFinal) || 'Final',
      fine: str(w.Fine) || 'No',
      nlcReceived: str(w.NlcReceived) || 'Yes',
      mbookNumbers: str(w.MbookNumbers),
      pages: str(w.Pages),
      pac: num(w.Pac),
      baseAmount: num(w.BaseAmount),
      gstAt18Percent: num(w.GstAt18Percent),
      billAmount: num(w.BillAmount),
      uptoDateBillAmount: num(w.UptoDateBillAmount),
      estimateAmount: num(w.EstimateAmount),
      electricityCharges: num(w.ElectricityCharges),
      extraItemCount: details.count,
      excessItems: details.excess,
      extraItems: details.extra,
      notes: details.notes,
      updatedAt: str(w.UpdatedAtUtc) || new Date().toISOString(),
    };
    return { ...bill, calculations: calculate(bill) };
  });

  return { bills: bills.filter((bill) => bill.agno), contractors: contractors.filter((c) => c.name), budgets: budgets.filter((b) => b.code) };
}
