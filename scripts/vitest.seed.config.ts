import { defineConfig } from 'vitest/config';

// Separate config so the seed script never runs as part of `npm test`.
export default defineConfig({ test: { include: ['scripts/seed-db.ts'], root: '.' } });
