import { config as loadDotenvx } from "@dotenvx/dotenvx";
import type { NextConfig } from "next";

// The npm scripts decrypt .env.local before Next.js starts. This also covers
// launches that bypass them (IDE or `npx next dev`), which would otherwise
// inline the literal `encrypted:...` values into the bundle.
const { parsed } = loadDotenvx({
  path: ".env.local",
  envKeysFile: ".env.keys",
  processEnv: {},
  quiet: true,
  noArmor: true,
  noNative: true,
  ignore: ["MISSING_ENV_FILE"],
});

for (const [key, value] of Object.entries(parsed ?? {})) {
  if (process.env[key]?.startsWith("encrypted:")) {
    process.env[key] = value;
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
