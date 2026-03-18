import { getTranslations } from 'next-intl/server';
export default async function Home() {
  const t = await getTranslations('agent');
  return <main><h1>HomeService AI</h1><p>{t('default_greeting')}</p></main>;
}
