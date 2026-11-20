import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/base";

const nextConfig: NextConfig = {
  // Subruta opcional (NEXT_PUBLIC_BASE_PATH), p. ej. si se sirve bajo un dominio compartido.
  basePath: BASE_PATH,
  // Build standalone: se sube .next/standalone al hosting y corre con node server.js
  output: "standalone",
  // Sin next/image → evitamos la dependencia nativa de sharp en el hosting.
  images: { unoptimized: true },
  // Raíz explícita: sin esto, los lockfiles de carpetas padre anidan el standalone.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
