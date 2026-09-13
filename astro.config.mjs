// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://wwm-wiki.example.com',
  markdown: {
    syntaxHighlight: 'shiki',
  },
});
