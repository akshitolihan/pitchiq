/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // In production on Vercel, /api/* hits the Python function directly.
    // In local dev, proxy to the FastAPI backend.
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/:path*",
          destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
