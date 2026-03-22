import Link from "next/link";

import { ROUTES } from "@/lib/constants/routes";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default function LandingPage() {
  return (
    <div className="py-4 sm:py-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-2xl font-black uppercase">Bingo online tipo spot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-black/70">
              Base inicial lista para autenticacion, billetera, partidas en tiempo real y panel
              administrativo.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={ROUTES.register}>
                <Button className="border-2 border-black bg-black text-white hover:bg-black/90">
                  Crear cuenta
                </Button>
              </Link>
              <Link href={ROUTES.login}>
                <Button className="border-2 border-black bg-white text-black hover:bg-neutral-200">
                  Entrar
                </Button>
              </Link>
              <Link href={ROUTES.dashboard}>
                <Button className="border-2 border-black bg-neutral-100 text-black hover:bg-neutral-200">
                  Ver dashboard base
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="font-black uppercase">Estado del modulo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-black/70">
            <p>- App Router activo</p>
            <p>- Tailwind configurado</p>
            <p>- Supabase listo para Auth/DB</p>
            <p>- Rutas publicas y privadas preparadas</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
