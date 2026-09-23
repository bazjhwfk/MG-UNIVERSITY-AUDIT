import { useState } from 'react';
import { GITHUB_DB, GITHUB_DB_URL } from '../data/github';
import { useData, type SyncState } from '../state/data';
import { Icon } from './icons';

export function syncLabel(sync: SyncState, hasToken: boolean): string {
  switch (sync.kind) {
    case 'syncing': return 'Syncing with GitHub…';
    case 'error': return `GitHub sync failed: ${sync.message}`;
    case 'ok': return `${sync.readOnly ? 'Loaded from' : 'Synced with'} GitHub at ${new Date(sync.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}${sync.readOnly ? ' (read-only: add a token to save changes)' : ''}`;
    default: return hasToken ? 'Waiting to sync with GitHub' : 'Not connected to GitHub';
  }
}

export function GitHubTab() {
  const data = useData();
  const [token, setToken] = useState('');

  return (
    <div className="github-tab">
      <div className={`sync-status ${data.sync.kind}`}>
        <span className="dot" />
        <span>{syncLabel(data.sync, data.hasToken)}</span>
        <button className="btn btn-dark" onClick={() => void data.syncNow()} disabled={data.sync.kind === 'syncing'}>Sync now</button>
      </div>

      <div className="warning">
        <Icon name="alert" />
        <div>
          <strong>This database is public.</strong> Bills are saved to{' '}
          <a href={GITHUB_DB_URL} target="_blank" rel="noreferrer">{GITHUB_DB.path}</a> in the public repository{' '}
          <strong>{GITHUB_DB.owner}/{GITHUB_DB.repo}</strong>. Anyone on the internet can read every bill, contractor, PAN and GST number in it,
          and every earlier version stays in the repository history.
        </div>
      </div>

      <h2 className="form-heading">How it works</h2>
      <ul className="plain-list">
        <li>Every computer loads the shared database from GitHub when the app opens. No token is needed to read.</li>
        <li>To save changes to GitHub, a computer needs an access token. Changes are sent about 2 seconds after each save, and each send is one commit in the repository.</li>
        <li>If two computers change different bills, both changes are kept. If they change the same bill, the most recent save wins. Deleted bills stay deleted.</li>
        <li>Bills are also kept in this browser, so the app keeps working offline and catches up on the next sync.</li>
      </ul>

      <h2 className="form-heading">Access token for this computer</h2>
      {data.hasToken ? (
        <div className="token-row">
          <span className="chip">A token is saved in this browser</span>
          <button className="btn btn-red" onClick={() => data.setToken(null)}>Remove token</button>
        </div>
      ) : (
        <>
          <ol className="plain-list">
            <li>On GitHub, open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">Settings → Developer settings → Fine-grained tokens → Generate new token</a>.</li>
            <li>Under <strong>Repository access</strong>, choose <strong>Only select repositories</strong> → <strong>{GITHUB_DB.repo}</strong>.</li>
            <li>Under <strong>Permissions → Contents</strong>, choose <strong>Read and write</strong>. Generate the token and paste it below.</li>
          </ol>
          <form className="token-row" onSubmit={(e) => { e.preventDefault(); if (token.trim()) { data.setToken(token); setToken(''); } }}>
            <input className="input" type="password" autoComplete="off" placeholder="github_pat_…" aria-label="GitHub access token"
              value={token} onChange={(e) => setToken(e.target.value)} />
            <button className="btn btn-yellow" type="submit" disabled={!token.trim()}>Save token</button>
          </form>
        </>
      )}
      <p className="hint">The token is stored only in this browser on this computer. It is never written to the repository.</p>
    </div>
  );
}
