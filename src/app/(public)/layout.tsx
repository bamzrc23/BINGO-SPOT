import type { ReactNode } from "react";

import { PublicHeader } from "@/components/layout/public-header";

type PublicLayoutProps = {
  children: ReactNode;
};

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-transparent">
      <PublicHeader />
      <main className="py-6">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[28px] border-4 border-black bg-neutral-100/88 p-2 backdrop-blur-[1px] sm:p-3">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
