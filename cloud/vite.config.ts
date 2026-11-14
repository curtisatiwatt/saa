import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

// This subproject builds only the API Worker. GitHub Pages stays buildless.
export default defineConfig({ plugins: [cloudflare()] });
