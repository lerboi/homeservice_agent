import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'Voco AI — AI Receptionist for Home Service Businesses',
  description: 'Stop losing revenue to missed calls. Voco AI answers, triages, and books every call in under 1 ring — for plumbers, HVAC, electricians, and handymen.',
  openGraph: {
    title: 'Voco AI — AI Receptionist for Home Service Businesses',
    description: 'Stop losing revenue to missed calls. Voco AI answers, triages, and books every call in under 1 ring.',
    type: 'website',
    siteName: 'Voco AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Voco AI — AI Receptionist for Home Service Businesses',
    description: 'Stop losing revenue to missed calls. Voco AI answers, triages, and books every call in under 1 ring.',
  },
};

// Async shell that reads request-time locale/messages from next-intl (cookies()).
// Under cacheComponents: true, this must live inside a <Suspense> boundary so the
// static HTML shell can prerender while locale resolution happens at request time.
async function LocaleShell({ children }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Prefetch Spline scene file — low priority, doesn't block initial render */}
        <link
          rel="prefetch"
          href="https://prod.spline.design/CN1NeDZqows-DMX0/scene.splinecode"
          crossOrigin="anonymous"
        />
      </head>
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
