import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tsConfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import { componentTagger } from 'lovable-tagger';

export default defineConfig(({ mode, command }) => ({
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
  ssr:
    command === 'build'
      ? {
          // Bundle all dependencies only for the production worker build.
          // Doing this in dev makes Vite try to evaluate CommonJS packages
          // like React via the SSR module runner, which crashes with
          // "ReferenceError: module is not defined".
          noExternal: true,
        }
      : undefined,
}));
