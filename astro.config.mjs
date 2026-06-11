// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
// GitHub Pages（プロジェクトページ）公開用。独自ドメイン/Cloudflareに移す時は base を '/' に。
export default defineConfig({
  site: 'https://moto-git.github.io',
  base: '/wn-archive/',

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()]
  }
});