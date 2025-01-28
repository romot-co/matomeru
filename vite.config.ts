import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig(({ mode }) => ({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/extension.ts'),
            formats: ['cjs'],
            fileName: () => 'extension.js'
        },
        rollupOptions: {
            external: [
                'vscode',
                'path',
                'fs',
                'util',
                'child_process',
                /node:.*/
            ],
            output: {
                format: 'cjs',
                interop: 'auto',
                dir: 'out',
                entryFileNames: 'extension.js'
            }
        },
        sourcemap: mode === 'development',
        outDir: 'out',
        emptyOutDir: true,
        target: 'node16',
        ssr: true,
        minify: mode === 'production',
        watch: mode === 'development' ? {} : null
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src')
        }
    },
    server: {
        watch: {
            ignored: ['**/out/**', '**/node_modules/**']
        }
    },
    optimizeDeps: {
        exclude: ['vscode']
    }
})); 
