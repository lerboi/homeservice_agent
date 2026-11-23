/**
 * Public-site constants shared by nav, footer, CTAs and metadata.
 */
export const SITE_URL = 'https://voco.live';
export const SITE_NAME = 'Voco';
export const TAGLINE = 'Give your backend a voice.';
export const SITE_TITLE = 'Voco: a voice agent that works in your systems';
export const SITE_DESCRIPTION =
  'Voco answers the call, understands the request, and does the work in the systems you already run: books the appointment, schedules the task, creates the record.';

export const BOOK_DEMO_HREF = '/contact?type=sales';
export const WATCH_DEMO_HREF = '/demo';

export const NAV_LINKS = [
  { href: '/#how-it-works', label: 'Product' },
  { href: '/use-cases', label: 'Use cases' },
  { href: '/integrations', label: 'Integrations' },
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
