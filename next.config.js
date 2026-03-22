import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./src/i18n/request.js');
/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.10.148'],
};
export default withNextIntl(nextConfig);
