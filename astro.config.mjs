// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://ultrainstinctcrew.com',
  base: '/',
  compressHTML: true,
  build: {
    format: 'file',
    inlineStylesheets: 'always'
  }
});
