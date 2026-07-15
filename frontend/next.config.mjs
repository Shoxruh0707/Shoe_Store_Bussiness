import { dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(fileURLToPath(import.meta.url));
const rootEnv = loadRootEnv();
const backendApiUrl = process.env.BACKEND_API_URL || 'http://127.0.0.1:3000/api';
const backendBaseUrl = backendApiUrl.replace(/\/api\/?$/, '');

function loadRootEnv() {
  try {
    return Object.fromEntries(
      readFileSync(`${appRoot}/../.env`, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const separatorIndex = line.indexOf('=');
          return [
            line.slice(0, separatorIndex).trim(),
            line
              .slice(separatorIndex + 1)
              .trim()
              .replace(/^['"]|['"]$/g, ''),
          ];
        })
    );
  } catch (_error) {
    return {};
  }
}

function envValue(name) {
  return process.env[name] || rootEnv[name] || '';
}

function hostFromUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  try {
    return new URL(text).host;
  } catch (_error) {
    return text
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .trim();
  }
}

const allowedDevOrigins = [
  '127.0.0.1',
  'localhost',
  hostFromUrl(envValue('PUBLIC_URL')),
  hostFromUrl(envValue('FRONTEND_URL')),
  hostFromUrl(envValue('TELEGRAM_WEBAPP_URL')),
  hostFromUrl(envValue('DOMAIN')),
  ...(envValue('ADDITIONAL_DOMAINS') || '')
    .split(',')
    .map(hostFromUrl),
  ...(envValue('NEXT_ALLOWED_DEV_ORIGINS') || '')
    .split(',')
    .map(hostFromUrl),
].filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: appRoot,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendApiUrl}/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendBaseUrl}/uploads/:path*`,
      },
    ];
  },
}

export default nextConfig
