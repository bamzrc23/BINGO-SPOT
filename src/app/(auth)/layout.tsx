import type { ReactNode } from "react";

import { SectionContainer } from "@/components/layout/section-container";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <SectionContainer className="flex min-h-screen items-center justify-center bg-transparent py-8">
      <div className="w-full max-w-lg rounded-[28px] border-4 border-black bg-neutral-100/90 p-3 backdrop-blur-[1px] sm:p-4">
        {children}
      </div>
    </SectionContainer>
  );
}
