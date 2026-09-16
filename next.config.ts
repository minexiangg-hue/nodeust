import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return ['login','register','verify-email','forgot-password','reset-password','logout'].map(path => ({
      source: `/${path}`,
      headers: [
        {key:'Referrer-Policy',value:'no-referrer'},
        {key:'X-Frame-Options',value:'DENY'},
        {key:'Content-Security-Policy',value:"frame-ancestors 'none'; base-uri 'self'; form-action 'self'"},
        {key:'Cache-Control',value:'no-store'},
      ],
    }));
  },
};

export default nextConfig;
