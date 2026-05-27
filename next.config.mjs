/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'yt3.ggpht.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'yt3.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Suppress chrome-extension fetch errors from Next.js dev overlay
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        { message: /Failed to fetch/ },
        { message: /chrome-extension/ },
      ]
    }
    return config
  },
}

export default nextConfig
