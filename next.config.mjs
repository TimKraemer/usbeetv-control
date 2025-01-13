/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  env: {
    NEXT_TELEMETRY_DISABLED: "true",
  },
}

export default nextConfig
