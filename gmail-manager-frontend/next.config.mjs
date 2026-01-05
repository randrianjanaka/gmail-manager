/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const destUrl = process.env.API_URL || 'http://127.0.0.1:8123';
    return [
      {
        source: '/api/:path*',
        destination: `${destUrl}/api/:path*`,
      },
    ]
  },

}

export default nextConfig
