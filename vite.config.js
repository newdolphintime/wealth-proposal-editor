import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages 部署在 /<仓库名>/ 子路径下；本地开发时使用根路径
export default defineConfig(({ command, isPreview }) => ({
  plugins: [vue()],
  base: command === 'serve' && !isPreview ? '/' : (process.env.BASE_PATH || '/wealth-proposal-editor/')
}))
