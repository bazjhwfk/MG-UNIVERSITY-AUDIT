import { useMemo, useState } from 'react';
import { billMatches } from '../domain/bill';
import { fiscalYear, formatDate, today } from '../domain/dates';
import type { Bill } from '../domain/types';
import { useData } from '../state/data';
import type { Session } from '../state/session';
import { Gauge, LineChart, StatusBars } from './charts';
import { compactRupees, initials, rupees } from './format';
import { Icon } from './icons';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
type Pending = 'Drafts' | 'Open notes' | 'Late';

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
}

export function Dashboard({ session, showBills }: { session: Session; showBills(query?: string): void }) {
  const data = useData();
  const [pending, setPending] = useState<Pending>('Drafts');
  const [query, setQuery] = useState('');

  const stats = useMemo(() => {
    const now = today();
    const fy = fiscalYear(now);
    const fyBills = data.bills.filter((b) => fiscalYear(b.billDate) === fy);
    const sum = (bills: Bill[], pick: (b: Bill) => number) => bills.reduce((s, b) => s + pick(b), 0);

    const [year, month] = now.split('-').map(Number);
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(year, month - 6 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return { label: MONTHS[d.getMonth()], value: sum(data.bills.filter((b) => b.billDate?.startsWith(key)), (b) => b.calculations.wit) };
    });

    const count = (status: string) => data.bills.filter((b) => b.status === status).length;
    return {
      fy,
      fyNet: sum(fyBills, (b) => b.calculations.wit),
      sixMonthNet: months.reduce((s, m) => s + m.value, 0),
      months,
      openNotes: data.bills.reduce((n, b) => n + b.notes.filter((x) => x.status === 'Open').length, 0),
      drafts: count('Draft'),
      audited: count('Audited'),
      paid: count('Paid'),
      deductions: [
        { label: 'GST', value: sum(fyBills, (b) => b.calculations.gst) },
        { label: 'Income Tax', value: sum(fyBills, (b) => b.calculations.it) },
        { label: 'WWC', value: sum(fyBills, (b) => b.calculations.wwc) },
        { label: 'Retention', value: sum(fyBills, (b) => b.calculations.retention) },
        { label: 'Fines', value: sum(fyBills, (b) => b.calculations.fine + b.calculations.fineagr) },
      ],
    };
  }, [data.bills]);

  const auditedPct = data.bills.length ? ((stats.audited + stats.paid) / data.bills.length) * 100 : 0;
  const pendingBills = data.bills.filter((b) =>
    pending === 'Drafts' ? b.status === 'Draft'
      : pending === 'Open notes' ? b.notes.some((n) => n.status === 'Open')
        : b.calculations.days > 0).slice(0, 2);
  const tableBills = data.bills.filter((b) => billMatches(b, query)).slice(0, 6);
  const dateLine = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="dashboard">
      <section className="card hero">
        <div className="hero-main">
          <h1>{greeting()}, Accountant</h1>
          <p className="muted">It’s {dateLine}</p>
          <div className="hero-stats">
            <Stat icon="bills" value={String(data.bills.length)} label="Bills" />
            <Stat icon="people" value={String(data.contractors.length)} label="Contractors" />
            <Stat icon="rupee" value={compactRupees(stats.fyNet)} label={`Net paid ${stats.fy ?? ''}`} />
            <Stat icon="clipboard" value={String(stats.openNotes)} label="Open audit notes" />
          </div>
        </div>
        <Gauge percent={auditedPct} label="Bills audited" />
      </section>

      <section className="card schedule">
        <div className="card-top">
          <span className="date-pill">{formatDate(today())} <Icon name="chevron" size={14} /></span>
          <h2>Pending work</h2>
          <button className="round-btn" aria-label="Show all bills" onClick={() => showBills()}><Icon name="more" /></button>
        </div>
        <div className="pill-tabs" role="tablist">
          {(['Drafts', 'Open notes', 'Late'] as Pending[]).map((p) => (
            <button key={p} role="tab" aria-selected={pending === p} className={pending === p ? 'on' : ''} onClick={() => setPending(p)}>{p}</button>
          ))}
        </div>
        {pendingBills.length === 0 ? (
          <p className="muted empty-note">Nothing here. {pending === 'Drafts' ? 'All bills are audited.' : pending === 'Late' ? 'No works completed late.' : 'No open audit notes.'}</p>
        ) : pendingBills.map((b, i) => (
          <article key={b.agno} className={i === 0 ? 'task highlight' : 'task'}>
            <div className="task-head">
              <h3>{b.nameOfWork || `Bill ${b.billRegisterNo}`}</h3>
              <button className={i === 0 ? 'round-btn dark' : 'round-btn soft'} aria-label={`Open bill ${b.billRegisterNo}`} onClick={() => session.open(b)}>
                <Icon name="link" size={16} />
              </button>
            </div>
            <p className="muted">{b.contractorName || 'No contractor'}</p>
            <div className="task-foot">
              <span className="chip">{b.billRegisterNo}</span>
              <span className="chip">{rupees(b.calculations.wit)}</span>
              <span className="avatar small">{initials(b.contractorName)}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="card kpi">
        <div className="card-top">
          <div>
            <div className="kpi-value"><Icon name="rupee" size={18} className="kpi-icon" />{compactRupees(stats.sixMonthNet)}</div>
            <p className="muted">Net payable, last 6 months</p>
          </div>
          <button className="round-btn white" aria-label="Open bill list" onClick={() => showBills()}><Icon name="arrow" /></button>
        </div>
        <LineChart points={stats.months} />
      </section>

      <section className="card status">
        <div className="card-top">
          <h2>Bill Status</h2>
          <button className="round-btn" aria-label="Open bill list" onClick={() => showBills()}><Icon name="more" /></button>
        </div>
        <div className="status-total"><strong>{data.bills.length}</strong><span>Bills saved</span></div>
        <StatusBars bars={[
          { label: 'Draft', value: stats.drafts, tone: 'yellow' },
          { label: 'Audited', value: stats.audited, tone: 'dark' },
          { label: 'Paid', value: stats.paid, tone: 'grey' },
        ]} />
      </section>

      <div className="tiles">
        {stats.deductions.map((d) => (
          <section key={d.label} className="card tile">
            <span className="dot" />
            <div className="tile-label">{d.label} {stats.fy}</div>
            <div className="tile-value">{compactRupees(d.value)}</div>
            <div className="tile-foot">
              <span>Deducted</span>
              <button className="round-btn tiny white" aria-label={`View bills for ${d.label}`} onClick={() => showBills()}><Icon name="arrow" size={14} /></button>
            </div>
          </section>
        ))}
      </div>

      <section className="card table-card">
        <div className="card-top">
          <h2>List Bills</h2>
          <div className="table-tools">
            <label className="search-pill">
              <Icon name="search" size={15} />
              <input type="search" placeholder="Search" aria-label="Search bills" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <button className="round-btn" aria-label="Open full bill list" onClick={() => showBills(query)}><Icon name="more" /></button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Name of work</th><th>Register no.</th><th>Contractor</th><th>Bill date</th><th>Status</th><th className="num">Net payable</th><th>Action</th></tr>
            </thead>
            <tbody>
              {tableBills.map((b) => (
                <tr key={b.agno}>
                  <td><div className="who"><span className="avatar">{initials(b.contractorName)}</span><span className="clip">{b.nameOfWork || '—'}</span></div></td>
                  <td>{b.billRegisterNo}</td>
                  <td>{b.contractorName || '—'}</td>
                  <td className="nowrap">{formatDate(b.billDate)}</td>
                  <td><span className={`status-chip ${b.status.toLowerCase()}`}>{b.status}</span></td>
                  <td className="num">{rupees(b.calculations.wit)}</td>
                  <td><button className="icon-btn" aria-label={`Open bill ${b.billRegisterNo}`} onClick={() => session.open(b)}><Icon name="more" /></button></td>
                </tr>
              ))}
              {tableBills.length === 0 && (
                <tr><td colSpan={7} className="empty-cell">{data.bills.length ? 'No bills match the search.' : 'No bills yet. Use New / Edit Bill to add one, or Restore JSON to bring in a desktop backup.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: Parameters<typeof Icon>[0]['name']; value: string; label: string }) {
  return (
    <div className="hero-stat">
      <span className="stat-icon"><Icon name={icon} size={14} /></span>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}
