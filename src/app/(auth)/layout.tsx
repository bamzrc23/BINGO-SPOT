import type { ReactNode } from "react";

import { SectionContainer } from "@/components/layout/section-container";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <SectionContainer className="flex min-h-screen items-center justify-center bg-neutral-300 py-8">
      <div className="w-full max-w-lg rounded-[28px] border-4 border-black bg-neutral-200 p-3 sm:p-4">
        {children}
      </div>
    </SectionContainer>
  );
}
