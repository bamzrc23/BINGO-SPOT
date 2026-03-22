import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/layout/admin-shell";
import { ROUTES } from "@/lib/constants/routes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/modules/auth/infrastructure";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const profile = await ensureProfileForUser(supabase, user);

  if (!profile || profile.account_status !== "active" || profile.role !== "admin") {
    redirect(ROUTES.dashboard);
  }

  return <AdminShell>{children}</AdminShell>;
}
