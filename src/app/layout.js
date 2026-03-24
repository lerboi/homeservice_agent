import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'Voco',
  description: 'AI voice receptionist for home service businesses',
};

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={inter.variable}>
      <head>
        {/* Preload Spline scene file so 3D hero loads faster */}
        <link
          rel="preload"
          href="https://prod.spline.design/CN1NeDZqows-DMX0/scene.splinecode"
          as="fetch"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
