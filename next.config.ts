import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Some browsers + phone shortcuts pin the dev server as 127.0.0.1 instead
  // of localhost. Next 16 treats these as separate origins by default and
  // BLOCKS HMR/websocket dev resources — the page then loads but client-side
  // data fetches and HMR never complete, leaving the UI on its loading state.
  // Whitelisting both (plus the LAN IP for phone testing) keeps the dev
  // experience identical no matter how the URL is reached.
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.103"],
};

export default nextConfig;
