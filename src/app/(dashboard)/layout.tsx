import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { UserShell } from "@/components/layout/user-shell";
import { ROUTES } from "@/lib/constants/routes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/modules/auth/infrastructure";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const profile = await ensureProfileForUser(supabase, user);
  if (!profile || profile.account_status !== "active") {
    await supabase.auth.signOut();
    redirect(ROUTES.login);
  }

  return <UserShell>{children}</UserShell>;
}
