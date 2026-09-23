import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bill } from '../domain/types';
import { buildReportHtml, REPORTS, type ReportId } from '../reports/buildReport';
import { Icon } from './icons';

export function ReportViewer({ bill, initial, onClose }: { bill: Bill; initial: ReportId; onClose(): void }) {
  const [report, setReport] = useState<ReportId>(initial);
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => buildReportHtml(bill, report), [bill, report]);
  const print = () => frame.current?.contentWindow?.print();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        print();
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Print preview">
      <header className="viewer-bar">
        <div className="viewer-title">
          <span className="eyebrow">Print preview · Bill {bill.billRegisterNo || '(unsaved)'}</span>
          <div className="viewer-tabs" role="tablist">
            {REPORTS.map((r) => (
              <button key={r.id} role="tab" aria-selected={r.id === report} className={r.id === report ? 'on' : ''} onClick={() => setReport(r.id)}>
                {r.title}
              </button>
            ))}
          </div>
        </div>
        <div className="viewer-actions">
          <button className="btn btn-primary" onClick={print}><Icon name="printer" /> Print / Save PDF</button>
          <button className="btn btn-ghost icon-only" onClick={onClose} aria-label="Close preview"><Icon name="close" /></button>
        </div>
      </header>
      <iframe ref={frame} className="viewer-frame" title="Report preview" srcDoc={html} />
      <p className="viewer-tip">To save a PDF, choose <strong>Save as PDF</strong> or <strong>Microsoft Print to PDF</strong> as the printer.</p>
    </div>
  );
}
