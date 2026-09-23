import { useMemo, useState } from 'react';
import { billMatches } from '../domain/bill';
import { BILL_STATUSES, type BillStatus } from '../domain/types';
import { useData } from '../state/data';
import { errorMessage, type Session } from '../state/session';

export function BillListTab({ session, initialQuery = '' }: { session: Session; initialQuery?: string }) {
  const data = useData();
  const [query, setQuery] = useState(initialQuery);
  const [search, setSearch] = useState(initialQuery);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<BillStatus>('Audited');
  const bills = useMemo(() => data.bills.filter((b) => billMatches(b, search)), [data.bills, search]);
  const selectedBill = bills.find((b) => b.agno === selected);

  const open = () => {
    if (!selectedBill) { session.show('Select a bill first.'); return; }
    session.open(selectedBill);
  };

  const applyStatus = async () => {
    if (!selectedBill) { session.show('Select a bill first.'); return; }
    try {
      await data.saveBill({ ...selectedBill, status, updatedAt: new Date().toISOString() }, selectedBill.agno);
      session.show(`Bill ${selectedBill.billRegisterNo} marked ${status}.`);
    } catch (error) {
      session.show('Status change failed: ' + errorMessage(error));
    }
  };

  const remove = async () => {
    if (!selectedBill) { session.show('Select a bill first.'); return; }
    if (!window.confirm(`Delete bill ${selectedBill.billRegisterNo}?`)) return;
    try {
      await data.deleteBill(selectedBill.agno);
      setSelected(null);
      session.show('Bill deleted.');
    } catch (error) {
      session.show('Delete failed: ' + errorMessage(error));
    }
  };

  return (
    <div className="list-tab">
      <div className="search-row">
        <input className="input" type="search" placeholder="Search bills" aria-label="Search bills" value={query}
          onChange={(e) => { setQuery(e.target.value); setSearch(e.target.value); }} />
        <button className="btn" onClick={() => setSearch(query)}>Refresh</button>
      </div>
      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr><th>Bill Register Number</th><th>Contractor</th><th className="wide">Work</th><th className="num">Base Amount</th><th className="num">Net Payable</th><th>Status</th></tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b.agno} className={b.agno === selected ? 'selected' : ''} aria-selected={b.agno === selected}
                onClick={() => setSelected(b.agno)} onDoubleClick={() => session.open(b)}>
                <td>{b.billRegisterNo}</td>
                <td>{b.contractorName}</td>
                <td className="wide">{b.nameOfWork}</td>
                <td className="num">{b.calculations.baseAmount}</td>
                <td className="num">{b.calculations.wit}</td>
                <td>{b.status}</td>
              </tr>
            ))}
            {bills.length === 0 && <tr><td colSpan={6} className="empty-cell">{data.bills.length ? 'No bills match the search.' : 'No bills saved yet.'}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="button-row right">
        <select className="input status-select" aria-label="New status" value={status} onChange={(e) => setStatus(e.target.value as BillStatus)}>
          {BILL_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn" onClick={() => void applyStatus()}>Set status</button>
        <button className="btn btn-dark" onClick={open}>Open selected</button>
        <button className="btn btn-red" onClick={() => void remove()}>Delete selected</button>
      </div>
    </div>
  );
}
