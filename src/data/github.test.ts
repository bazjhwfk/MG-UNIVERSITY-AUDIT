import { describe, expect, it } from 'vitest';
import { TEST_BILLS, TEST_CONTRACTORS } from '../domain/testBills';
import { decodeBase64, encodeBase64, parseDbFile, syncWithGitHub } from './github';
import { mergeDbFiles, serializeDbFile, type DbFile } from './merge';

const empty = (): DbFile => ({ bills: [], contractors: [], budgets: [], deleted: [] });
const [billA, billB] = TEST_BILLS;

/** In-memory stand-in for the GitHub contents API, with sha-based conflict detection. */
function fakeGitHub(initial: DbFile | null, { conflictOnce = false } = {}) {
  let text = initial ? serializeDbFile(initial) : null;
  let version = 1;
  let conflicts = conflictOnce ? 1 : 0;
  const puts: string[] = [];
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    if (!init?.method || init.method === 'GET') {
      if (text === null) return new Response('{}', { status: 404 });
      return Response.json({ sha: `v${version}`, encoding: 'base64', content: encodeBase64(text) });
    }
    const body = JSON.parse(String(init.body)) as { sha?: string; content: string };
    if (conflicts > 0) {
      conflicts--;
      version++; // simulate another computer saving first
      return new Response('{}', { status: 409 });
    }
    if (text !== null && body.sha !== `v${version}`) return new Response('{}', { status: 409 });
    text = decodeBase64(body.content);
    version++;
    puts.push(text);
    return Response.json({ content: { sha: `v${version}` } }, { status: 201 });
  }) as typeof fetch;
  return { fetchImpl, puts, current: () => (text ? parseDbFile(text) : null) };
}

describe('GitHub database', () => {
  it('round-trips unicode through base64', () => {
    const text = 'Engineering Works – ₹3,54,000 · നിർമ്മാണം';
    expect(decodeBase64(encodeBase64(text))).toBe(text);
  });

  it('creates the file on first sync and pushes nothing when already up to date', async () => {
    const gh = fakeGitHub(null);
    const local = { ...empty(), bills: [billA], contractors: TEST_CONTRACTORS };
    expect((await syncWithGitHub(local, 'token', gh.fetchImpl)).pushed).toBe(true);
    expect(gh.current()?.bills.map((b) => b.agno)).toEqual([billA.agno]);
    expect((await syncWithGitHub(local, 'token', gh.fetchImpl)).pushed).toBe(false);
    expect(gh.puts).toHaveLength(1);
  });

  it('merges another computer’s bills instead of overwriting them', async () => {
    const gh = fakeGitHub({ ...empty(), bills: [billB] });
    const { merged } = await syncWithGitHub({ ...empty(), bills: [billA] }, 'token', gh.fetchImpl);
    expect(merged.bills.map((b) => b.agno).sort()).toEqual([billA.agno, billB.agno].sort());
    expect(gh.current()?.bills).toHaveLength(2);
  });

  it('retries after a save conflict', async () => {
    const gh = fakeGitHub({ ...empty(), bills: [billB] }, { conflictOnce: true });
    expect((await syncWithGitHub({ ...empty(), bills: [billA] }, 'token', gh.fetchImpl)).pushed).toBe(true);
    expect(gh.current()?.bills).toHaveLength(2);
  });

  it('reads without a token and never writes', async () => {
    const gh = fakeGitHub({ ...empty(), bills: [billB] });
    const { merged, pushed } = await syncWithGitHub({ ...empty(), bills: [billA] }, null, gh.fetchImpl);
    expect(pushed).toBe(false);
    expect(merged.bills).toHaveLength(2);
    expect(gh.puts).toHaveLength(0);
  });
});

describe('mergeDbFiles', () => {
  it('keeps the most recently saved version of a record', () => {
    const older = { ...billA, nameOfWork: 'old', updatedAt: '2026-09-01T00:00:00Z' };
    const newer = { ...billA, nameOfWork: 'new', updatedAt: '2026-09-02T00:00:00Z' };
    expect(mergeDbFiles({ ...empty(), bills: [newer] }, { ...empty(), bills: [older] }).bills[0].nameOfWork).toBe('new');
    expect(mergeDbFiles({ ...empty(), bills: [older] }, { ...empty(), bills: [newer] }).bills[0].nameOfWork).toBe('new');
  });

  it('does not bring back a deleted bill, unless it was saved again later', () => {
    const bill = { ...billA, updatedAt: '2026-09-01T00:00:00Z' };
    const deleted = { ...empty(), deleted: [{ id: `bill:${bill.agno}`, type: 'bill' as const, key: bill.agno, at: '2026-09-05T00:00:00Z' }] };
    expect(mergeDbFiles(deleted, { ...empty(), bills: [bill] }).bills).toHaveLength(0);
    const resaved = { ...bill, updatedAt: '2026-09-06T00:00:00Z' };
    expect(mergeDbFiles(deleted, { ...empty(), bills: [resaved] }).bills).toHaveLength(1);
  });
});
