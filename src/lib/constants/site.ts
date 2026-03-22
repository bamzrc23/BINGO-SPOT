export const siteConfig = {
  name: "Bingo Spot",
  description:
    "Plataforma de bingo online preparada para web y web movil con arquitectura modular.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
} as const;
