import { defineConfig } from 'vite';

const base = process.env.VERCEL === '1' ? '/' : '/voltage-lab/';

export default defineConfig({
  base,
  build: { outDir: 'dist' },
});
