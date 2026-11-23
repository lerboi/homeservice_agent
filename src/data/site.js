/**
 * Public-site constants shared by nav, footer, CTAs and metadata.
 */
export const SITE_URL = 'https://voco.live';
export const SITE_NAME = 'Voco';
/** Site-level line covering both products. */
export const HEADLINE = 'AI that does the work.';
/** Voco Voice's own line. */
export const TAGLINE = 'Give your backend a voice.';
export const SITE_TITLE = 'Voco: AI that answers your calls and does the work in your systems';
export const SITE_DESCRIPTION =
  'Voco builds two AI workers into the systems a business already runs. Voco Voice answers calls and books, schedules and records. Voco Agent handles reviews, inbox, search data and calendar from a chat message.';

export const BOOK_DEMO_HREF = '/contact?type=sales';
export const WATCH_DEMO_HREF = '/demo';

/** The two products. Neither leads: they are listed side by side everywhere. */
export const PRODUCTS = {
  voice: { name: 'Voco Voice', href: '/voice', tone: 'signal' },
  agent: { name: 'Voco Agent', href: '/agent', tone: 'spark' },
};

export const NAV_LINKS = [
  { href: '/voice', label: 'Voice' },
  { href: '/agent', label: 'Agent' },
  { href: '/use-cases', label: 'Use cases' },
  { href: '/demo', label: 'Demo' },
  { href: '/pricing', label: 'Pricing' },
];

/**
 * The recorded product demo. Set `src` (an MP4 URL or a path under /public)
 * once the recording exists; while it is null the site shows a designed
 * placeholder instead of a player.
 */
export const DEMO_VIDEO = {
  src: null,
  poster: null,
};

/** Path of a generated Open Graph image. */
export function ogImage(title, type = 'VOCO') {
  return `/og?title=${encodeURIComponent(title)}&type=${encodeURIComponent(type)}`;
}

/** Standard page metadata with Open Graph and Twitter cards. */
export function pageMetadata({ title, description, path, ogTitle, ogType }) {
  const image = ogImage(ogTitle || title, ogType);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: SITE_NAME,
      url: path,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
