import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// metadataBase makes relative OG/Twitter image URLs resolve to absolute URLs
// on link previews (2026-06-12 audit M24). Defaults to prod; override via env.
const TITLE = 'Voco: AI that answers your calls and does the work in your systems';
const DESCRIPTION =
  'Voco builds two AI workers into the systems a business already runs. Voco Voice answers calls and books, schedules and records. Voco Agent handles reviews, inbox, search data and calendar from a chat message.';
const OG_IMAGE = '/og?title=AI%20that%20does%20the%20work.&type=VOCO';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://voco.live'),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    siteName: 'Voco',
    url: '/',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Voco: give your backend a voice' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

// Async shell that reads request-time locale/messages from next-intl (cookies()).
// Under cacheComponents: true, this must live inside a <Suspense> boundary so the
// static HTML shell can prerender while locale resolution happens at request time.
async function LocaleShell({ children }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="relative">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

// Minimal static fallback while LocaleShell resolves. Keeps <html> present so
// hydration has something to attach to and prevents a flash of unstyled content.
function LocaleFallback() {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="relative" />
    </html>
  );
}

export default function RootLayout({ children }) {
  return (
    <Suspense fallback={<LocaleFallback />}>
      <LocaleShell>{children}</LocaleShell>
    </Suspense>
  );
}
