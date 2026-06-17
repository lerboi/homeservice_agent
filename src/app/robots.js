export default function robots() {
  return {
    // Keep the app/private surfaces out of the index (2026-06-12 audit M24).
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/api', '/auth', '/onboarding'],
      },
    ],
    sitemap: 'https://voco.live/sitemap.xml',
    host: 'https://voco.live',
  };
}
