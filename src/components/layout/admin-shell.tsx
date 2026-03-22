import type { ReactNode } from "react";
import Link from "next/link";

import { ROUTES } from "@/lib/constants/routes";
import { LogoutButton } from "@/modules/auth/ui";

import { SectionContainer } from "@/components/layout/section-container";

type AdminShellProps = {
  children: ReactNode;
};

const adminNavItems = [
  { href: ROUTES.admin, label: "Resumen" },
  { href: ROUTES.adminUsers, label: "Usuarios" },
  { href: ROUTES.adminTopups, label: "Recargas" },
  { href: ROUTES.adminWithdrawals, label: "Retiros" },
  { href: ROUTES.adminGames, label: "Partidas" },
  { href: ROUTES.adminSettings, label: "Configuracion" },
  { href: ROUTES.adminAudit, label: "Auditoria" }
] as const;

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-neutral-300">
      <header className="border-b-4 border-black bg-neutral-100">
        <SectionContainer className="flex min-h-16 flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={ROUTES.admin}
            className="w-fit rounded-lg border-2 border-black bg-white px-3 py-1 text-sm font-black uppercase tracking-wide text-danger"
          >
            Panel Administrador
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex flex-wrap items-center gap-2">
              {adminNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm font-semibold text-black hover:bg-neutral-200"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <LogoutButton className="h-9 border-2 border-black bg-black px-3 text-white hover:bg-black/90" />
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
