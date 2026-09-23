import { emptyBill } from '../domain/bill';
import { calculate } from '../domain/calculator';
import type { Bill } from '../domain/types';
import { mergeDbFiles, serializeDbFile, type DbFile, type Tombstone } from './merge';

/** The shared database: one JSON file in the app's own (public) repository. */
export const GITHUB_DB = { owner: 'bazjhwfk', repo: 'MG-UNIVERSITY-AUDIT', path: 'data/db.json', branch: 'main' } as const;
export const GITHUB_DB_URL = `https://github.com/${GITHUB_DB.owner}/${GITHUB_DB.repo}/blob/${GITHUB_DB.branch}/${GITHUB_DB.path}`;
const API = `https://api.github.com/repos/${GITHUB_DB.owner}/${GITHUB_DB.repo}/contents/${GITHUB_DB.path}`;

type Fetch = typeof fetch;

export function encodeBase64(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeBase64(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function parseDbFile(text: string): DbFile {
  const raw = JSON.parse(text) as Partial<DbFile> & { format?: string };
  if (raw.format !== 'bill-audit-backup') throw new Error('data/db.json is not a Bill Audit database file.');
  const bills = (raw.bills ?? []).map((b) => {
    const bill = { ...emptyBill(), ...b } as Bill;
    return { ...bill, calculations: calculate(bill) };
  });
  return { bills, contractors: raw.contractors ?? [], budgets: raw.budgets ?? [], deleted: (raw.deleted ?? []) as Tombstone[] };
}

function headers(token: string | null, accept = 'application/vnd.github+json'): HeadersInit {
  return { Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', ...(token && { Authorization: `Bearer ${token}` }) };
}

async function failure(res: Response, writing: boolean): Promise<Error> {
  if (res.status === 401) return new Error('GitHub rejected the access token. It may be wrong or expired.');
  if (res.status === 403 || res.status === 404) {
    if (res.headers.get('x-ratelimit-remaining') === '0') return new Error('GitHub’s hourly request limit was reached. Add an access token or try again later.');
    if (writing) return new Error('The access token is not allowed to write to the repository. Give it “Contents: Read and write” for MG-UNIVERSITY-AUDIT.');
  }
  const body = await res.text().catch(() => '');
  return new Error(`GitHub error ${res.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
}

export interface Remote { sha: string | null; file: DbFile | null }

/** Plain file URL; not subject to the API's 60-requests-per-hour limit for anonymous readers. */
export const RAW_URL = `https://raw.githubusercontent.com/${GITHUB_DB.owner}/${GITHUB_DB.repo}/${GITHUB_DB.branch}/${GITHUB_DB.path}`;

export async function readRemote(token: string | null, fetchImpl: Fetch = fetch): Promise<Remote> {
  if (!token) {
    // Read-only computers never write, so they don't need the file's sha. The raw
    // server may serve a copy up to about 5 minutes old; merging makes that harmless.
    const res = await fetchImpl(RAW_URL, { cache: 'no-store' });
    if (res.status === 404) return { sha: null, file: null };
    if (!res.ok) throw await failure(res, false);
    return { sha: null, file: parseDbFile(await res.text()) };
  }
  const url = `${API}?ref=${GITHUB_DB.branch}`;
  const res = await fetchImpl(url, { headers: headers(token), cache: 'no-store' });
  if (res.status === 404) return { sha: null, file: null };
  if (!res.ok) throw await failure(res, false);
  const meta = (await res.json()) as { sha: string; content?: string; encoding?: string };
  // Files over 1 MB come back without inline content; fetch the raw bytes instead.
  let text: string;
  if (meta.encoding === 'base64' && meta.content) {
    text = decodeBase64(meta.content);
  } else {
    const raw = await fetchImpl(url, { headers: headers(token, 'application/vnd.github.raw+json'), cache: 'no-store' });
    if (!raw.ok) throw await failure(raw, false);
    text = await raw.text();
  }
  return { sha: meta.sha, file: parseDbFile(text) };
}

export async function writeRemote(token: string, file: DbFile, sha: string | null, fetchImpl: Fetch = fetch): Promise<'ok' | 'conflict'> {
  const res = await fetchImpl(API, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Update bill database (${file.bills.length} bills)`,
      content: encodeBase64(serializeDbFile(file)),
      branch: GITHUB_DB.branch,
      ...(sha && { sha }),
    }),
  });
  if (res.ok) return 'ok';
  // Someone else saved first (stale sha); the caller re-reads and merges.
  if (res.status === 409 || res.status === 422) return 'conflict';
  throw await failure(res, true);
}

/**
 * Pulls the shared file, merges it with local data, and (with a token) writes
 * the merged result back. Retries when another computer saves in between.
 */
export async function syncWithGitHub(local: DbFile, token: string | null, fetchImpl: Fetch = fetch): Promise<{ merged: DbFile; pushed: boolean }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const remote = await readRemote(token, fetchImpl);
    const merged = remote.file ? mergeDbFiles(local, remote.file) : mergeDbFiles(local, { bills: [], contractors: [], budgets: [], deleted: [] });
    if (!token) return { merged, pushed: false };
    if (remote.file && serializeDbFile(merged) === serializeDbFile(remote.file)) return { merged, pushed: false };
    if ((await writeRemote(token, merged, remote.sha, fetchImpl)) === 'ok') return { merged, pushed: true };
  }
  throw new Error('Another computer kept saving at the same moment. Try “Sync now” again.');
}
