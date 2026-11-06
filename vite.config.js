import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// Bibliotecas grandes ficam em arquivos próprios: o navegador as guarda em
// cache entre deploys e só baixa quando uma página realmente precisa delas.
// Atenção: o Rollup arrasta para um chunk manual as dependências não atribuídas
// dos módulos dele; por isso utilitários compartilhados (clsx etc.) ficam em vendor-ui.
const VENDOR_CHUNKS = {
  'vendor-react': ['react', 'react-dom', 'react-router-dom', 'scheduler'],
  'vendor-charts': ['recharts', 'd3-', 'victory-vendor'],
  'vendor-xlsx': ['xlsx'],
  'vendor-editor': ['react-quill', 'quill'],
  'vendor-supabase': ['@supabase'],
  'vendor-ui': ['@radix-ui', 'clsx', 'tailwind-merge', 'class-variance-authority', 'lucide-react'],
}

export default defineConfig({
  logLevel: 'error',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Helper interno do Rollup usado por vários pacotes CommonJS; sem isto ele
          // cai no chunk de gráficos e força o download do recharts no primeiro acesso.
          if (id.includes('commonjsHelpers')) return 'vendor-react'
          if (!id.includes('node_modules')) return undefined
          const pkg = id.split('node_modules/').pop()
          for (const [chunk, prefixes] of Object.entries(VENDOR_CHUNKS)) {
            if (prefixes.some((p) => pkg.startsWith(p))) return chunk
          }
          return undefined
        },
      },
    },
  },
})
