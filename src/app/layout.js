import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'HomeService AI',
  description: 'AI voice receptionist for home service businesses',
};

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={inter.variable}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
