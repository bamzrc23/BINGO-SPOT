# Bingo Online Proyecto - Base Arquitectura

Base profesional del proyecto para una plataforma de bingo online con enfoque modular, escalable y segura.

## Stack
- Next.js (App Router)
- React + TypeScript estricto
- Tailwind CSS
- Supabase (`Auth`, `PostgreSQL`, `Realtime`, `Storage`)

## Inicio rapido
```bash
npm install
cp .env.example .env.local
npm run dev
```

## Estructura principal
```txt
src/
  app/                 # Rutas y layouts App Router
  components/          # UI reusable y shells de layout
  lib/                 # Config, utilidades, validaciones y servicios base
  modules/             # Arquitectura por dominio (auth, user, wallet, game, payments, admin)
  types/               # Tipos globales y tipos de base de datos
middleware.ts          # Control de rutas publicas/privadas + refresh de sesion
```

## Convenciones de naming
- Carpetas y archivos: `kebab-case`
- Componentes React: `PascalCase`
- Tipos e interfaces: `PascalCase`
- Variables y funciones: `camelCase`
- Constantes globales: `UPPER_SNAKE_CASE`
- Esquemas Zod: `camelCase` + sufijo `Schema`

## Capas por modulo (regla)
- `domain/`: entidades, tipos y reglas puras
- `application/`: casos de uso y orquestacion
- `infrastructure/`: acceso a Supabase/APIs/repositorios
- `ui/`: componentes y adapters para vistas
