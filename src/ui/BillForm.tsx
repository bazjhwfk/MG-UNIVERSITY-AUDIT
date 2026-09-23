import { useMemo } from 'react';
import { newId } from '../domain/bill';
import { calculate, gstAt18Percent } from '../domain/calculator';
import { CC_NUMBERS, type Bill, type ExcessItem } from '../domain/types';
import { useData } from '../state/data';
import type { Session } from '../state/session';
import { DateInput, Field, NumberInput, Select, TextArea, TextInput } from './fields';
import { number } from './format';
import { downloadBackup, restoreBackup } from './transfer';

export function BillForm({ session }: { session: Session }) {
  const data = useData();
  const { draft, update } = session;
  const calc = useMemo(() => calculate(draft), [draft]);
  const field = <K extends keyof Bill>(key: K) => (value: Bill[K]) => update({ [key]: value } as Partial<Bill>);

  const chooseContractor = (id: string) => {
    const c = data.contractors.find((x) => x.id === id);
    update({ contractorId: c?.id ?? null, contractorName: c?.name ?? '', contractorAddress: c?.address ?? '', contractorGstNo: c?.gstNo ?? '', contractorPanNo: c?.panNo ?? '' });
  };
  const chooseBudget = (id: string) => {
    const b = data.budgets.find((x) => x.id === id);
    update({ budgetId: b?.id ?? null, budgetCode: b?.code ?? '', headOfAccountLabel: b?.headOfAccount ?? '' });
  };

  const calculateClick = () => {
    if (!draft.billRegisterNo.trim()) { session.show('Bill register number is required.'); return; }
    session.show('Calculation complete.');
  };

  const saveExtraCount = () => {
    if (!session.savedKey) { session.show('Save the bill first, then add extra items.'); return; }
    void session.save(draft, 'Extra item count saved.');
  };

  const saveExcess = () => {
    if (!session.savedKey) { session.show('Save the bill first, then add excess quantities.'); return; }
    if (draft.excessItems.some((i) => !Number.isInteger(i.itemNo) || i.estimateQty < 0 || i.actualQty < 0 || i.excessQty <= 0)) {
      session.show('Enter a valid item number, estimate, actual, and excess quantity for every excess row.');
      return;
    }
    void session.save(draft, `${draft.excessItems.length} excess quantity row(s) saved.`);
  };

  const backup = () => {
    downloadBackup({ bills: data.bills, contractors: data.contractors, budgets: data.budgets });
    session.show('JSON backup created.');
  };
  const restore = async () => {
    const result = await restoreBackup(data.importSnapshot);
    if (result) session.show(result);
  };

  const editExcess = (id: string, changes: Partial<ExcessItem>) =>
    update({
      excessItems: draft.excessItems.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...changes };
        if ('estimateQty' in changes || 'actualQty' in changes) next.excessQty = Math.max(0, next.actualQty - next.estimateQty);
        return next;
      }),
    });

  return (
    <div className="form">
      <h2 className="form-heading">Form1 - Identification</h2>
      <div className="row cols-3">
        <Field label="Bill Register Number"><TextInput value={draft.billRegisterNo} onChange={field('billRegisterNo')} /></Field>
        <Field label="Audit Enfacement Sheet Number"><TextInput value={draft.auditEnfacementSheetNo} onChange={field('auditEnfacementSheetNo')} /></Field>
        <Field label="Payment Register Number"><TextInput value={draft.paymentRegisterNo} onChange={field('paymentRegisterNo')} /></Field>
      </div>
      <div className="row cols-3">
        <Field label="Person or Company"><Select value={draft.personCompany} onChange={field('personCompany')} options={['Person', 'Company']} /></Field>
        <Field label="Head of Account">
          <Select value={draft.budgetId ?? ''} onChange={chooseBudget} placeholder={draft.budgetId ? '' : draft.headOfAccountLabel}
            options={data.budgets.map((b) => ({ value: b.id, label: b.headOfAccount || b.code }))} />
        </Field>
        <Field label="Bill Date"><DateInput value={draft.billDate} onChange={field('billDate')} /></Field>

        <Field label="Contractor">
          <Select value={draft.contractorId ?? ''} onChange={chooseContractor} placeholder={draft.contractorId ? '' : draft.contractorName}
            options={data.contractors.map((c) => ({ value: c.id, label: c.name }))} />
        </Field>
        <Field label="Section"><TextInput value={draft.section} onChange={field('section')} /></Field>
        <Field label="Work Order Number"><TextInput value={draft.workOrderNo} onChange={field('workOrderNo')} /></Field>

        <Field label="Agreement Number"><TextInput value={draft.agreementNo} onChange={field('agreementNo')} /></Field>
        <div className="stack">
          <Field label="Administrative Sanction or Purchase Sanction Number"><TextInput value={draft.esasNo} onChange={field('esasNo')} /></Field>
          <Field label="Administrative / Purchase Sanction Date"><DateInput value={draft.esasDate} onChange={field('esasDate')} /></Field>
        </div>
        <div className="stack">
          <Field label="Technical Sanction or Quantity Survey Number"><TextInput value={draft.tsqsNo} onChange={field('tsqsNo')} /></Field>
          <Field label="Technical / Quantity Survey Date"><DateInput value={draft.tsqsDate} onChange={field('tsqsDate')} /></Field>
        </div>

        <Field label="Name of Work" wide><TextArea rows={1} value={draft.nameOfWork} onChange={field('nameOfWork')} /></Field>
      </div>
      <div className="row cols-4">
        <Field label="Upto Date Bill Amount"><NumberInput value={draft.uptoDateBillAmount} onChange={field('uptoDateBillAmount')} /></Field>
        <Field label="GST Deduction (2% of Base Value above 2.5 lakh)"><input className="input num" readOnly value={calc.gst} /></Field>
        <Field label="Measurement Book Pages (linked)"><TextInput value={draft.pages} onChange={field('pages')} /></Field>
        <Field label="Date of Measurement by Assistant Engineer"><DateInput value={draft.measurementByAE} onChange={field('measurementByAE')} /></Field>
      </div>
      <div className="row cols-4">
        <Field label="Date of Check Measurement by Assistant Executive Engineer"><DateInput value={draft.measurementByAEE} onChange={field('measurementByAEE')} /></Field>
      </div>

      <h2 className="form-heading">Form1 - Reference &amp; Completion</h2>
      <div className="row cols-4">
        <Field label="Work Order Date"><DateInput value={draft.workOrderDate} onChange={field('workOrderDate')} /></Field>
        <Field label="Agreement Date"><DateInput value={draft.agreementDate} onChange={field('agreementDate')} /></Field>
        <Field label="Date of Completion"><DateInput value={draft.documentDate} onChange={field('documentDate')} /></Field>
        <Field label="Actual Date of Completion"><DateInput value={draft.actualDocumentDate} onChange={field('actualDocumentDate')} /></Field>
      </div>
      <div className="row cols-5">
        <Field label="Continuation Certificate Number"><Select value={draft.ccn} onChange={field('ccn')} options={CC_NUMBERS} /></Field>
        <Field label="Part or Final Bill"><Select value={draft.partFinal} onChange={field('partFinal')} options={['Final', 'Part']} /></Field>
        <Field label="Fine Waiver"><Select value={draft.fine} onChange={field('fine')} options={['No', 'Yes']} /></Field>
        <Field label="N.L.C. Received"><Select value={draft.nlcReceived} onChange={field('nlcReceived')} options={['Yes', 'No']} /></Field>
        <Field label="Measurement Book Number"><TextInput value={draft.mbookNumbers} onChange={field('mbookNumbers')} /></Field>
      </div>

      <div className="inline-row">
        <label htmlFor="extra-count">Extra items (Nos.)</label>
        <input id="extra-count" className="input num narrow" inputMode="numeric" value={draft.extraItemCount}
          title="Enter the number of extra items, for example 1 or 2."
          onChange={(e) => update({ extraItemCount: Math.max(0, Math.floor(Number(e.target.value.replace(/\D/g, '')) || 0)) })} />
        <button className="btn btn-dark" onClick={saveExtraCount}>Save extra item count</button>
      </div>

      <fieldset className="group">
        <legend>Excess quantities</legend>
        <p className="hint">Add one row for each item with excess quantity. Extra items are entered separately above.</p>
        <div className="excess-grid excess-head" aria-hidden="true">
          <span>Extra item no.</span><span>Estimate quantity</span><span>Actual quantity</span><span>Unit</span><span>Excess quantity</span><span />
        </div>
        {draft.excessItems.map((item) => (
          <div className="excess-grid" key={item.id}>
            <NumberInput ariaLabel="Item No." value={item.itemNo} onChange={(itemNo) => editExcess(item.id, { itemNo })} />
            <NumberInput ariaLabel="Estimate Quantity" value={item.estimateQty} onChange={(estimateQty) => editExcess(item.id, { estimateQty })} />
            <NumberInput ariaLabel="Actual Quantity" value={item.actualQty} onChange={(actualQty) => editExcess(item.id, { actualQty })} />
            <TextInput aria-label="Unit" value={item.unit} onChange={(unit) => editExcess(item.id, { unit })} />
            <NumberInput ariaLabel="Excess Quantity" value={item.excessQty} onChange={(excessQty) => editExcess(item.id, { excessQty })} />
            <button className="btn" onClick={() => update({ excessItems: draft.excessItems.filter((i) => i.id !== item.id) })}>Remove</button>
          </div>
        ))}
        <div className="button-row">
          <button className="btn" onClick={() => update({ excessItems: [...draft.excessItems, { id: newId(), itemNo: 1, estimateQty: 0, actualQty: 0, unit: '', excessQty: 0 }] })}>
            Add excess quantity row
          </button>
          <button className="btn btn-dark" onClick={saveExcess}>Save excess quantities</button>
        </div>
      </fieldset>

      <h2 className="form-heading">Form1 - Amounts</h2>
      <div className="row cols-5">
        <Field label="Agreed Probable Amount of Contract"><NumberInput value={draft.pac} onChange={field('pac')} /></Field>
        <div className="stack">
          <Field label="Base Value"><NumberInput value={draft.baseAmount} onChange={(v) => update({ baseAmount: v, gstAt18Percent: gstAt18Percent(v) })} /></Field>
          <Field label="GST (Base Value * 18%)"><NumberInput value={draft.gstAt18Percent} onChange={field('gstAt18Percent')} /></Field>
        </div>
        <Field label="Bill Amount"><NumberInput value={draft.billAmount} onChange={field('billAmount')} /></Field>
        <Field label="Estimate Amount"><NumberInput value={draft.estimateAmount} onChange={field('estimateAmount')} /></Field>
        <Field label="Electricity Charges"><NumberInput value={draft.electricityCharges} onChange={field('electricityCharges')} /></Field>
      </div>

      <div className="button-row actions">
        <button className="btn btn-dark" onClick={calculateClick}>Calculate</button>
        <button className="btn btn-yellow" onClick={() => void session.save()}>Save bill</button>
        <button className="btn" onClick={() => session.print('audit-notes')}>Audit Notes</button>
        <button className="btn" onClick={() => session.print('aes-register')}>Audit Enfacement Sheet Register</button>
        <button className="btn" onClick={() => session.print('payment-register')}>Payment Register</button>
        <button className="btn" onClick={() => session.print('schedule-formats')}>Direct Service Deduction Schedule</button>
        <button className="btn" onClick={() => session.print('audit-enfacement-format')}>Note to Finance Officer / Enfacement Format</button>
        <button className="btn btn-grey" onClick={session.clear}>Clear form</button>
        <button className="btn" onClick={backup}>Backup JSON</button>
        <button className="btn" onClick={() => void restore()}>Restore JSON</button>
      </div>

      <div className="results cols-4">
        <Result label="GST Deduction (2% above 2.5 lakh)" value={calc.gst} />
        <Result label="Income Tax" value={calc.it} />
        <Result label="Total Deductions" value={calc.dwoit} />
        <Result label="Net Payable" value={calc.wit} accent />
      </div>
      <div className="results cols-3">
        <Result label="WWC" value={calc.wwc} small />
        <Result label="Cess amount to the board" value={calc.wwcCessToBoard} small />
        <Result label="Collection charge to FO's account" value={calc.wwcCollectionCharge} small />
      </div>
    </div>
  );
}

function Result({ label, value, accent, small }: { label: string; value: number; accent?: boolean; small?: boolean }) {
  return (
    <div className={['result', accent && 'accent', small && 'small'].filter(Boolean).join(' ')}>
      <div className="result-label">{label}</div>
      <div className="result-value">{number(value)}</div>
    </div>
  );
}
