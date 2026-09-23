import { useState } from 'react';
import { newId } from '../domain/bill';
import { today } from '../domain/dates';
import { NOTE_CATEGORIES } from '../domain/types';
import type { Session } from '../state/session';
import { NumberInput, Select, TextInput } from './fields';

// Same order as the desktop app, where Medium is the default.
const RISKS = ['Medium', 'Low', 'High', 'Critical'];

export function AuditDetailsTab({ session }: { session: Session }) {
  const { draft, savedKey } = session;
  const [category, setCategory] = useState('Observation');
  const [risk, setRisk] = useState('Medium');
  const [description, setDescription] = useState('');
  const [extra, setExtra] = useState({ description: '', itemNo: 1, estimateQty: 0, actualQty: 0, rate: 0 });
  const excess = Math.max(0, extra.actualQty - extra.estimateQty);

  const saveNote = async () => {
    if (!savedKey) { session.show('Save or open a bill first.'); return; }
    if (!description.trim()) { session.show('Audit note failed: Audit note description is required.'); return; }
    const note = { id: newId(), category, riskLevel: risk, description: description.trim(), status: 'Open' as const, auditDate: today() };
    if (await session.save({ ...draft, notes: [note, ...draft.notes] }, 'Audit note saved locally.')) setDescription('');
  };

  const saveExtra = async () => {
    if (!savedKey) { session.show('Save or open a bill first.'); return; }
    const item = { id: newId(), ...extra, amount: extra.actualQty * extra.rate };
    if (await session.save({ ...draft, extraItems: [...draft.extraItems, item] }, 'Extra item saved locally.')) {
      setExtra((e) => ({ ...e, description: '' }));
    }
  };

  // Like the desktop grid, list excess-quantity rows and itemised extra items together.
  const rows = [
    ...draft.excessItems.map((i) => ({ id: i.id, itemNo: i.itemNo, estimate: i.estimateQty, actual: i.actualQty, excess: i.excessQty, amount: 0 })),
    ...draft.extraItems.map((i) => ({ id: i.id, itemNo: i.itemNo, estimate: i.estimateQty, actual: i.actualQty, excess: Math.max(0, i.actualQty - i.estimateQty), amount: i.amount })),
  ];

  return (
    <div className="audit-tab">
      <p className="hint">{savedKey ? `Current bill: ${savedKey}` : 'Save or open a bill on the New / Edit Bill tab first.'}</p>
      <fieldset className="group">
        <legend>Audit note</legend>
        <div className="label-grid">
          <label aria-hidden="true">Category</label>
          <Select ariaLabel="Category" value={category} onChange={setCategory} options={NOTE_CATEGORIES} />
          <label aria-hidden="true">Risk</label>
          <Select ariaLabel="Risk" value={risk} onChange={setRisk} options={RISKS} />
          <label htmlFor="note-description">Description</label>
          <input id="note-description" className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          <span />
          <div><button className="btn btn-dark" onClick={() => void saveNote()}>Save note for current bill</button></div>
        </div>
        {draft.notes.length > 0 && (
          <div className="grid-wrap">
            <table className="grid">
              <thead><tr><th>Date</th><th>Category</th><th>Risk</th><th className="wide">Description</th><th>Status</th></tr></thead>
              <tbody>
                {draft.notes.map((n) => (
                  <tr key={n.id}><td>{n.auditDate}</td><td>{n.category}</td><td>{n.riskLevel}</td><td className="wide">{n.description}</td><td>{n.status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </fieldset>

      <fieldset className="group">
        <legend>Extra item</legend>
        <div className="label-grid four">
          <label>Description</label><TextInput aria-label="Description" value={extra.description} onChange={(d) => setExtra({ ...extra, description: d })} />
          <label>Item Number</label><NumberInput ariaLabel="Item Number" value={extra.itemNo} onChange={(itemNo) => setExtra({ ...extra, itemNo })} />
          <label>Estimate Quantity</label><NumberInput ariaLabel="Estimate Quantity" value={extra.estimateQty} onChange={(estimateQty) => setExtra({ ...extra, estimateQty })} />
          <label>Actual Quantity</label><NumberInput ariaLabel="Actual Quantity" value={extra.actualQty} onChange={(actualQty) => setExtra({ ...extra, actualQty })} />
          <label>Excess Quantity</label><input className="input num" aria-label="Excess Quantity" readOnly value={excess} />
          <label>Rate</label><NumberInput ariaLabel="Rate" value={extra.rate} onChange={(rate) => setExtra({ ...extra, rate })} />
          <span />
          <div><button className="btn btn-dark" onClick={() => void saveExtra()}>Save extra item for current bill</button></div>
        </div>
        <div className="grid-wrap">
          <table className="grid">
            <thead><tr><th>Item No.</th><th className="num">Estimate Quantity</th><th className="num">Actual Quantity</th><th className="num">Excess Quantity</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}><td>{r.itemNo}</td><td className="num">{r.estimate}</td><td className="num">{r.actual}</td><td className="num">{r.excess}</td><td className="num">{r.amount}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>
    </div>
  );
}
