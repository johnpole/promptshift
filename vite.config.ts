import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { build as viteBuild } from 'vite';

/**
 * Custom Vite plugin to:
 * 1. Build the content script and service worker as separate IIFE bundles
 * 2. Copy Chrome Extension static files (manifest, CSS, icons) into dist/
 */
function buildExtensionScripts(): Plugin {
  return {
    name: 'build-extension-scripts',
    async writeBundle() {
      const env = loadEnv('production', '.', '');
      const apiKey = env.GROQ_API_KEY || env.GEMINI_API_KEY || '';

      // Build content script
      await viteBuild({
        configFile: false,
        build: {
          emptyOutDir: false,
          outDir: path.resolve(__dirname, 'dist'),
          lib: {
            entry: path.resolve(__dirname, 'src/content.ts'),
            name: 'PromptShiftContent',
            fileName: () => 'content.js',
            formats: ['iife'],
          },
          rollupOptions: {
            output: {
              extend: true,
            },
          },
          minify: true,
          sourcemap: false,
        },
        define: {
          'chrome': 'chrome',
        },
      });

      // Build service worker
      await viteBuild({
        configFile: false,
        build: {
          emptyOutDir: false,
          outDir: path.resolve(__dirname, 'dist'),
          lib: {
            entry: path.resolve(__dirname, 'src/service_worker.ts'),
            name: 'PromptShiftWorker',
            fileName: () => 'service_worker.js',
            formats: ['iife'],
          },
          rollupOptions: {
            output: {
              extend: true,
            },
          },
          minify: true,
          sourcemap: false,
        },
        define: {
          'PROMPTSHIFT_API_KEY': JSON.stringify(apiKey),
        },
      });

      // Copy static files
      const filesToCopy = [
        { src: 'manifest.json', dest: 'manifest.json' },
        { src: 'src/content.css', dest: 'content.css' },
        { src: 'assets/icons/icon16.png', dest: 'assets/icons/icon16.png' },
        { src: 'assets/icons/icon32.png', dest: 'assets/icons/icon32.png' },
        { src: 'assets/icons/icon48.png', dest: 'assets/icons/icon48.png' },
        { src: 'assets/icons/icon128.png', dest: 'assets/icons/icon128.png' },
      ];

      for (const file of filesToCopy) {
        const src = path.resolve(__dirname, file.src);
        const dest = path.resolve(__dirname, 'dist', file.dest);
        if (fs.existsSync(src)) {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
        } else {
          console.warn(`[PromptShift] Missing static file: ${file.src}`);
        }
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), buildExtensionScripts()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GROQ_API_KEY || env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GROQ_API_KEY': JSON.stringify(env.GROQ_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
