import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tsConfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import { componentTagger } from 'lovable-tagger';

export default defineConfig(({ mode }) => ({
  plugins: [
    mode !== 'development' && cloudflare(),
    tanstackStart({
      server: {
        entry: './server',
      },
    }),
    react(),
    tsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  server: {
    host: '0.0.0.0',
    port: 8080,
    allowedHosts: true,
  },
  ssr: {
    // Bundle ALL dependencies into the worker build. Partial lists break
    // production: e.g. bundling 'h3-v2' while leaving its dep 'rou3'
    // external produced "No such module assets/rou3" crashes on deploy.
    noExternal: true,
  },
}));
