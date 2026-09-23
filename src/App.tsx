import { useEffect, useRef, useState } from 'react';
import { emptyBill, finalizeBill } from './domain/bill';
import type { Bill } from './domain/types';
import { REPORTS, type ReportId } from './reports/buildReport';
import { useData } from './state/data';
import { errorMessage, type Session } from './state/session';
import { AuditDetailsTab } from './ui/AuditDetailsTab';
import { BillForm } from './ui/BillForm';
import { BillListTab } from './ui/BillListTab';
import { Dashboard } from './ui/Dashboard';
import { GitHubTab, syncLabel } from './ui/GitHubTab';
import { Icon, type IconName } from './ui/icons';
import { MasterDataTab } from './ui/MasterDataTab';
import { ReportViewer } from './ui/ReportViewer';
import { downloadBackup, restoreBackup } from './ui/transfer';

type PageId = 'home' | 'bill' | 'list' | 'master' | 'audit' | 'github';

const PAGES: { id: PageId; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Dashboard', icon: 'grid' },
  { id: 'bill', label: 'New / Edit Bill', icon: 'filePlus' },
  { id: 'list', label: 'Bill List', icon: 'list' },
  { id: 'master', label: 'Master Data', icon: 'people' },
  { id: 'audit', label: 'Audit Details', icon: 'clipboard' },
];
const GITHUB_PAGE = { id: 'github' as const, label: 'GitHub Database', icon: 'database' as const };

export function App() {
  const data = useData();
  const [page, setPage] = useState<PageId>('home');
  const [listQuery, setListQuery] = useState({ text: '', key: 0 });
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Bill>(emptyBill);
  const [savedKey, setSavedKey] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('Starting local database...');
  const [report, setReport] = useState<{ bill: Bill; id: ReportId } | null>(null);
  const [printOpen, setPrintOpen] = useState(true);
  const [dataOpen, setDataOpen] = useState(true);

  useEffect(() => {
    if (!data.ready) return;
    setMessage(data.error
      ? `The browser blocked local storage, so bills cannot be saved (${data.error}). Open the app in a normal, non-private window.`
      : 'Local browser database ready.');
  }, [data.ready, data.error]);

  // Warn before closing the browser tab with unsaved changes.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => { if (dirtyRef.current) event.preventDefault(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const session: Session = {
    draft,
    savedKey,
    update(changes) {
      setDraft((d) => ({ ...d, ...changes }));
      setDirty(true);
    },
    async save(next = draft, success = 'Bill saved locally.') {
      const bill = finalizeBill(next, data.contractors, data.budgets);
      if (!bill.agno) {
        setMessage('Bill register number is required.');
        return false;
      }
      try {
        await data.saveBill(bill, savedKey);
        setDraft(bill);
        setSavedKey(bill.agno);
        setDirty(false);
        setMessage(success);
        return true;
      } catch (error) {
        setMessage('Save failed: ' + errorMessage(error));
        return false;
      }
    },
    open(bill) {
      setDraft(bill);
      setSavedKey(bill.agno);
      setDirty(false);
      setPage('bill');
      setMessage(`Bill ${bill.billRegisterNo} loaded for editing.`);
    },
    clear() {
      setDraft(emptyBill());
      setSavedKey(undefined);
      setDirty(false);
      setMessage('Form cleared.');
    },
    show: setMessage,
    print(id) {
      setReport({ bill: finalizeBill(draft, data.contractors, data.budgets), id });
    },
  };

  // Ctrl+S saves the current bill from any page.
  const saveRef = useRef(session.save);
  saveRef.current = session.save;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const showBills = (text = '') => {
    setListQuery((q) => ({ text, key: q.key + 1 }));
    setPage('list');
  };
  const backup = () => {
    downloadBackup({ bills: data.bills, contractors: data.contractors, budgets: data.budgets });
    setMessage('JSON backup created.');
  };
  const restore = async () => {
    const result = await restoreBackup(data.importSnapshot);
    if (result) setMessage(result);
  };

  const current = page === 'github' ? GITHUB_PAGE : PAGES.find((p) => p.id === page)!;
  const online = data.ready && !data.error;
  const syncText = syncLabel(data.sync, data.hasToken);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-name">Bill Audit</span>
        </div>

        <form className="side-search" role="search" onSubmit={(e) => { e.preventDefault(); showBills(search); }}>
          <Icon name="search" size={16} />
          <input placeholder="Search here" aria-label="Search bills" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>

        <nav className="nav-tiles" aria-label="Main">
          {PAGES.map((p) => (
            <button key={p.id} className={page === p.id ? 'nav-tile on' : 'nav-tile'} aria-current={page === p.id ? 'page' : undefined}
              onClick={() => (p.id === 'list' ? showBills() : setPage(p.id))}>
              <Icon name={p.icon} size={20} />
              <span>{p.label}</span>
            </button>
          ))}
          <button className="nav-tile" onClick={() => session.print('audit-notes')}>
            <Icon name="printer" size={20} />
            <span>Print</span>
          </button>
        </nav>

        <div className="side-section">
          <button className="side-heading" aria-expanded={printOpen} onClick={() => setPrintOpen((o) => !o)}>
            <Icon name="chevron" size={14} className={printOpen ? '' : 'rot'} /> Print forms
          </button>
          {printOpen && (
            <ul className="bullet-list">
              {REPORTS.map((r) => (
                <li key={r.id}><button onClick={() => session.print(r.id)}><span className="square" />{r.title}</button></li>
              ))}
            </ul>
          )}
        </div>

        <div className="side-section">
          <button className="side-heading" aria-expanded={dataOpen} onClick={() => setDataOpen((o) => !o)}>
            <Icon name="chevron" size={14} className={dataOpen ? '' : 'rot'} /> Data
          </button>
          {dataOpen && (
            <div className="side-actions">
              <button onClick={backup}><Icon name="download" size={16} />Backup JSON</button>
              <button onClick={() => void restore()}><Icon name="upload" size={16} />Restore JSON</button>
              <button className={page === 'github' ? 'on' : ''} onClick={() => setPage('github')}><Icon name="database" size={16} />GitHub Database</button>
              <button onClick={() => { session.clear(); setPage('bill'); }}><Icon name="filePlus" size={16} />New bill</button>
            </div>
          )}
        </div>

        <div className="side-foot">
          <div className="profile">
            <span className="avatar">DA</span>
            <div>
              <div className="profile-name">Divisional Accountant</div>
              <div className="profile-role">MG University</div>
            </div>
          </div>
          <button className={`bell ${data.sync.kind}`} title={syncText} aria-label={`${syncText}. Open GitHub Database`} onClick={() => setPage('github')}>
            <Icon name="bell" size={18} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumbs"><button onClick={() => setPage('home')}>Home</button> / <span>{current.label}</span></div>
          <div className="top-actions">
            <button className="square-btn" aria-label="Print current bill" title="Print current bill" onClick={() => session.print('audit-notes')}><Icon name="printer" /></button>
            <button className="square-btn" aria-label="Backup JSON" title="Backup JSON" onClick={backup}><Icon name="download" /></button>
          </div>
        </header>

        <div className="message" role="status" aria-live="polite"><span className="dot" />{message}</div>

        {!online && (
          <section className="card page-card status-card" role="alert">
            <h1>{data.ready ? 'The local database could not be opened' : 'Opening the local database…'}</h1>
            {data.error && <p>{data.error}</p>}
            {data.ready && <button className="btn btn-dark" onClick={() => window.location.reload()}>Reload</button>}
          </section>
        )}
        {online && (page === 'home'
          ? <Dashboard session={session} showBills={showBills} />
          : (
            <section className="card page-card">
              <div className="page-title">
                <h1>{current.label}</h1>
                {page === 'bill' && <span className="muted">{savedKey ? `Editing bill ${savedKey}${dirty ? ' · unsaved changes' : ''}` : 'New bill'}</span>}
              </div>
              {page === 'bill' && <BillForm session={session} />}
              {page === 'list' && <BillListTab key={listQuery.key} session={session} initialQuery={listQuery.text} />}
              {page === 'master' && <MasterDataTab session={session} />}
              {page === 'audit' && <AuditDetailsTab session={session} />}
              {page === 'github' && <GitHubTab />}
            </section>
          ))}
      </div>

      {report && <ReportViewer bill={report.bill} initial={report.id} onClose={() => setReport(null)} />}
    </div>
  );
}
