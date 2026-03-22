import type { ReactNode } from "react";
import Link from "next/link";

import { ROUTES } from "@/lib/constants/routes";
import { LogoutButton } from "@/modules/auth/ui";

import { SectionContainer } from "@/components/layout/section-container";

type UserShellProps = {
  children: ReactNode;
};

const navItems = [
  { href: ROUTES.dashboard, label: "Inicio" },
  { href: ROUTES.profile, label: "Perfil" },
  { href: ROUTES.wallet, label: "Billetera" },
  { href: ROUTES.history, label: "Historial" },
  { href: ROUTES.game, label: "Partidas" }
] as const;

export function UserShell({ children }: UserShellProps) {
  return (
    <div className="min-h-screen bg-neutral-300">
      <header className="border-b-4 border-black bg-neutral-100">
        <SectionContainer className="py-2 sm:flex sm:min-h-16 sm:items-center sm:justify-between sm:py-1">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={ROUTES.dashboard}
              className="rounded-lg border-2 border-black bg-white px-3 py-1 text-sm font-black uppercase tracking-wide text-black"
            >
              BINGO RETRO SPOT
            </Link>
            <LogoutButton className="h-9 border-2 border-black bg-black px-3 text-xs text-white hover:bg-black/90 sm:text-sm" />
          </div>

          <div className="mt-2 overflow-x-auto pb-1 sm:mt-0 sm:pb-0">
            <nav className="flex min-w-max items-center gap-1 sm:gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-lg border-2 border-black bg-white px-2.5 py-1.5 text-sm font-semibold text-black transition hover:bg-neutral-200 sm:px-3"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </SectionContainer>
      </header>
      <main className="bg-neutral-300">
        <SectionContainer className="py-6">
          <div className="rounded-[28px] border-4 border-black bg-neutral-200 p-2 sm:p-3">
            {children}
          </div>
        </SectionContainer>
      </main>
    </div>
  );
}
