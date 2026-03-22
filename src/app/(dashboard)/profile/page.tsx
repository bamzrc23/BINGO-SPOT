import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/modules/auth/infrastructure";
import { ProfileForm } from "@/modules/auth/ui";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const profile = await ensureProfileForUser(supabase, user);
  if (!profile) {
    redirect(ROUTES.dashboard);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-black uppercase tracking-tight text-black">Perfil</h1>
        <Badge variant={profile.account_status === "active" ? "success" : "default"}>
          {profile.account_status}
        </Badge>
      </div>

      <Card className="rounded-[22px] border-4 border-black bg-neutral-100 text-black">
        <CardHeader>
          <CardTitle>Informacion basica</CardTitle>
          <CardDescription>Gestiona tus datos de cuenta y contacto.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaults={{
              firstName: profile.first_name,
              lastName: profile.last_name,
              nickname: profile.nickname,
              phone: profile.phone ?? "",
              email: profile.email,
              role: profile.role,
              accountStatus: profile.account_status
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
