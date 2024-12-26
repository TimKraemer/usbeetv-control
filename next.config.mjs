/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  env: {
    NEXT_TELEMETRY_DISABLED: 1,
  },
}

export default nextConfig
