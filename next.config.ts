import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const WINDOWS_WATCH_IGNORES = [
  "**/System Volume Information/**",
  "**/$RECYCLE.BIN/**",
  "**/pagefile.sys",
  "**/swapfile.sys",
  "**/hiberfil.sys"
];

export default function buildNextConfig(phase: string): NextConfig {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    reactStrictMode: true,
    // Evita colisiones entre dev/build cuando ambos procesos existen al mismo tiempo.
    distDir: isDev ? ".next-dev" : ".next-build",
    eslint: {
      // next lint esta deprecado en Next 15+; mantenemos build desacoplado del linter.
      ignoreDuringBuilds: true
    },
    webpack: (config, { dev }) => {
      if (dev) {
        // En Windows algunos entornos bloquean renames de cache webpack (*.pack.gz).
        // Usamos cache en memoria para evitar corrupcion de chunks.
        config.cache = false;
        config.watchOptions = {
          ...config.watchOptions,
          poll: 1000,
          aggregateTimeout: 300,
          ignored: [
            "**/node_modules/**",
            "**/.next/**",
            "**/.next-dev/**",
            "**/.next-build/**",
            ...WINDOWS_WATCH_IGNORES
          ]
        };
      }

      return config;
    }
  };
}
