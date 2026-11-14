import { bindings, defineConfig } from 'cf/config';

// Public deployment identifiers only. No client pairing code or key is stored here.
export default defineConfig({
  accountId: '062cd27f59034e0d8a8c78d3e127eb39',
  worker: {
    name: 'saa-progress-sync',
    entrypoint: './worker.js',
    compatibilityDate: '2026-11-13',
    workersDev: true,
    previewUrls: false,
    env: {
      DB: bindings.d1({ id: 'fec07a3b-56c4-4e96-b116-b923cfb35d28' }),
    },
    observability: {
      enabled: true,
      redactQueryString: true,
      logs: { enabled: true, invocationLogs: true, headSamplingRate: 1 },
      traces: { enabled: true, headSamplingRate: 0.1 },
    },
  },
});
