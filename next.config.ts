import type { NextConfig } from 'next';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
if (basePath && (!basePath.startsWith('/') || basePath.endsWith('/'))) {
  throw new Error('NEXT_PUBLIC_BASE_PATH must begin with / and have no trailing slash');
}
const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  reactStrictMode: true,
  experimental: { globalNotFound: true },
};
export default config;
