import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { emptyBill } from '../domain/bill';
import { exportBackup, parseBackup } from './backup';
import { clearAll, loadAll, putBill, putMany } from './db';

// Shape written by the desktop app's WorkOrderStore.ExportBackup (Newtonsoft.Json defaults).
const desktopBackup = {
  WorkOrders: [
    {
      Agno: 'BR-101', BillRegisterNo: 'BR-101', AuditEnfacementSheetNo: 'AES-7', PaymentRegisterNo: 'PR-3',
      BillDate: '2026-09-09T00:00:00', PersonCompany: 'Company', ContractorId: 'c1', ContractorName: 'Acme Builders',
      BudgetId: 'b1', BudgetCode: 'EW-01', HeadOfAccountLabel: 'Engineering Works', Section: 'Civil',
      NameOfWork: 'Roof repair', WorkOrderNo: 'WO-9', AgreementNo: 'AG-4', Ccn: 'II', PartFinal: 'Part', Fine: 'No',
      NlcReceived: 'Yes', Pac: 500000.0, BaseAmount: 300000.0, BillAmount: 354000.0, GstAt18Percent: 54000.0,
      ElectricityCharges: 0.0, DocumentDate: '2026-03-01T00:00:00', ActualDocumentDate: '2026-03-04T00:00:00',
      WorkOrderDate: null, AgreementDate: null, MeasurementByAE: '0001-01-01T00:00:00', Status: 'Draft',
      UpdatedAtUtc: '2026-09-09T10:00:00Z', Calculations: { Wit: 1 },
    },
  ],
  Contractors: [{ Id: 'c1', Name: 'Acme Builders', EntityType: 'Company', Address: 'Kottayam', GstNo: '32ABC', PanNo: 'ABCDE1234F', IsActive: true }],
  Budgets: [{ Id: 'b1', Code: 'EW-01', HeadOfAccount: 'Engineering Works', Allocation: 1000000.0, Balance: 1000000.0, IsActive: true }],
  ExtraItems: [
    { Id: 'x1', WorkOrderId: 'BR-101', ItemNo: 4, EstimatedQty: 10.0, ActualQty: 12.5, ExcessQuantity: 2.5, ExcessQty: 2.5, IsExtraItem: false, ExtraCount: 0, Unit: 'm3', Rate: 0.0 },
    { Id: 'x2', WorkOrderId: 'BR-101', ItemNo: 0, EstimatedQty: 0.0, ActualQty: 0.0, ExcessQuantity: 0.0, ExcessQty: 0.0, IsExtraItem: true, ExtraCount: 2, Rate: 0.0 },
    { Id: 'x3', WorkOrderId: 'BR-101', ItemNo: 7, Description: 'Parapet', EstimatedQty: 0.0, ActualQty: 3.0, IsExtraItem: true, ExtraCount: 1, Rate: 450.0, Amount: 1350.0 },
  ],
  AuditNotes: [{ Id: 'n1', WorkOrderId: 'BR-101', Category: 'Finding', RiskLevel: 'High', Description: 'Check M-book', Status: 'Open', AuditDate: '2026-09-10T00:00:00' }],
};

describe('parseBackup', () => {
  it('imports a desktop NativeAudit backup', () => {
    const { source, bills, contractors, budgets } = parseBackup(JSON.stringify(desktopBackup));
    expect(source).toBe('desktop');
    expect(contractors).toHaveLength(1);
    expect(budgets[0]).toMatchObject({ code: 'EW-01', allocation: 1000000 });

    const [bill] = bills;
    expect(bill).toMatchObject({
      agno: 'BR-101', billDate: '2026-09-09', personCompany: 'Company', partFinal: 'Part', ccn: 'II',
      contractorAddress: 'Kottayam', contractorGstNo: '32ABC', documentDate: '2026-03-01', measurementByAE: null,
      extraItemCount: 2,
    });
    expect(bill.excessItems).toEqual([{ id: 'x1', itemNo: 4, estimateQty: 10, actualQty: 12.5, unit: 'm3', excessQty: 2.5 }]);
    expect(bill.extraItems).toMatchObject([{ itemNo: 7, description: 'Parapet', rate: 450, amount: 1350 }]);
    expect(bill.notes).toMatchObject([{ category: 'Finding', riskLevel: 'High', auditDate: '2026-09-10' }]);
    // Stored calculations are ignored and recomputed from the inputs.
    // 354000 − (GST 6000 + IT 6000 + WWC 3000 + retention 7500 + part-week fine 5000)
    expect(bill.calculations.wit).toBe(326500);
  });

  it('round-trips its own format', () => {
    const bill = { ...emptyBill(), agno: 'B1', billRegisterNo: 'B1', baseAmount: 1000 };
    const parsed = parseBackup(exportBackup({ bills: [bill], contractors: [], budgets: [] }));
    expect(parsed.source).toBe('web');
    expect(parsed.bills[0]).toMatchObject({ agno: 'B1', baseAmount: 1000 });
    expect(parsed.bills[0].calculations.billAmount).toBe(1180);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow('not valid JSON');
    expect(() => parseBackup('{"hello":1}')).toThrow('not a Bill Audit');
  });
});

describe('IndexedDB store', () => {
  it('stores imports and renames bills atomically', async () => {
    await clearAll();
    await putMany(parseBackup(JSON.stringify(desktopBackup)));
    let data = await loadAll();
    expect(data.bills.map((b) => b.agno)).toEqual(['BR-101']);

    const renamed = { ...data.bills[0], agno: 'BR-102', billRegisterNo: 'BR-102' };
    await putBill(renamed, 'BR-101');
    data = await loadAll();
    expect(data.bills.map((b) => b.agno)).toEqual(['BR-102']);
    expect(data.contractors).toHaveLength(1);
  });
});
