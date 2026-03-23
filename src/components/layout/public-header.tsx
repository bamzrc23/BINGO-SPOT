import Link from "next/link";

import { ROUTES } from "@/lib/constants/routes";

import { Button } from "@/components/ui";
import { SectionContainer } from "@/components/layout/section-container";

export function PublicHeader() {
  return (
    <header className="border-b-4 border-black bg-white/90 backdrop-blur-sm">
      <SectionContainer className="flex h-16 items-center justify-between">
        <Link
          href={ROUTES.home}
          className="rounded-lg border-2 border-black bg-white px-3 py-1 text-sm font-black uppercase tracking-wide text-black"
        >
          BINGO RETRO SPOT
        </Link>
        <div className="flex items-center gap-3">
          <Link href={ROUTES.register}>
            <Button className="border-2 border-black bg-black text-white hover:bg-black/90">
              Registrarse
            </Button>
          </Link>
          <Link href={ROUTES.login}>
            <Button className="border-2 border-black bg-white text-black hover:bg-neutral-200">
              Iniciar sesion
            </Button>
          </Link>
        </div>
      </SectionContainer>
    </header>
  );
}
