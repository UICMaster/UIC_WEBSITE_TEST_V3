import type { APIRoute } from 'astro';
import rawPrimeStats from '../../../data/prime_stats.json';

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(rawPrimeStats), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  });
};

