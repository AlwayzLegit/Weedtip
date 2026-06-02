import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Keep authenticated, transactional, and API surfaces out of the index.
      disallow: [
        '/admin',
        '/dashboard',
        '/account',
        '/orders',
        '/cart',
        '/api/',
        '/sign-in',
        '/sign-up',
        '/forgot-password',
        '/auth/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
