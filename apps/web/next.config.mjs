/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile workspace packages so their TS source is compiled by Next.
  transpilePackages: ['@weedtip/shared', '@weedtip/supabase'],
  // Lint runs as its own Turborepo task (root flat config); don't re-run during build.
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      // Supabase Storage public buckets (avatars, dispensary-media, product-images).
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

export default nextConfig;
