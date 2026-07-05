import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(fileURLToPath(import.meta.url));
const backendApiUrl = process.env.BACKEND_API_URL || 'http://127.0.0.1:3000/api';
const allowedDevOrigins = [
  '127.0.0.1',
  'localhost',
  'ferruginous-nonamphibiously-kinley.ngrok-free.dev',
];

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
    ];
  },
}

export default nextConfig
