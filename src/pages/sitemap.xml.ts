import type { APIRoute } from 'astro';
import { honoredPlayers } from '../utils/honoredData';

export const GET: APIRoute = () => {
  const lastmod = new Date().toISOString().split('T')[0];
  const pages = [
    { loc: 'https://ultrainstinctcrew.com/', priority: '1.00' },
    { loc: 'https://ultrainstinctcrew.com/honored', priority: '0.80' },
    ...honoredPlayers.map((p) => ({
      loc: `https://ultrainstinctcrew.com/honored/${p.slug}`,
      priority: '0.70'
    })),
    { loc: 'https://ultrainstinctcrew.com/impressum.html', priority: '0.30' },
    { loc: 'https://ultrainstinctcrew.com/datenschutzbestimmungen.html', priority: '0.30' }
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) => `  <url>
    <loc>${p.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${p.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
};

