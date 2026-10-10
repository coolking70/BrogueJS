import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['docs/ext/evidence/narrative2/*.draft.test.ts'],testTimeout:240000}});
