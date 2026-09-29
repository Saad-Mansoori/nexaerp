import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

function loadRootEnv(): void {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, '.env'))) {
      loadEnvConfig(dir, process.env.NODE_ENV !== 'production');
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return;
    }
    dir = parent;
  }
}

loadRootEnv();

const strictContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  headers() {
    return Promise.resolve([
      {
        source: '/:path*',
        headers:
          process.env.NODE_ENV === 'production'
            ? [
                { key: 'Content-Security-Policy', value: strictContentSecurityPolicy },
                ...securityHeaders,
              ]
            : securityHeaders,
      },
    ]);
  },
};

export default nextConfig;
