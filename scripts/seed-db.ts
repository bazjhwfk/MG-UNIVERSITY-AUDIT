// Writes data/db.json (the shared GitHub database) containing the sample test bills.
// Run with: npm run seed:test-bills
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { serializeDbFile } from '../src/data/merge';
import { TEST_BILLS, TEST_BUDGETS, TEST_CONTRACTORS } from '../src/domain/testBills';

it('writes data/db.json', () => {
  const file = { bills: TEST_BILLS, contractors: TEST_CONTRACTORS, budgets: TEST_BUDGETS, deleted: [] };
  writeFileSync('data/db.json', serializeDbFile(file));
  console.log(`Wrote ${TEST_BILLS.length} bills, ${TEST_CONTRACTORS.length} contractors, ${TEST_BUDGETS.length} budgets to data/db.json`);
});
