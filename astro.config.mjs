import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import tina from '@tinacms/astro/integration';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  site: process.env.SITE_URL || 'https://my-blog.vercel.app',
  integrations: [
    sitemap(),
    tina(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
