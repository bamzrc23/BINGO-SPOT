import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTopupsByUserId } from "@/modules/payments/application/topups.service";
import {
  BankTransferTopupForm,
  TopupSecurityInfo,
  UserTopupsTable
} from "@/modules/payments/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default async function TopupsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  let topups = [] as Awaited<ReturnType<typeof getTopupsByUserId>>;
  let topupError: string | null = null;

  try {
    topups = await getTopupsByUserId(user.id, { limit: 40 });
  } catch (error) {
    topupError =
      error instanceof Error ? error.message : "No se pudo cargar el historial de recargas.";
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <BankTransferTopupForm />
        <TopupSecurityInfo />
      </div>

      {topupError ? (
        <Card className="rounded-[22px] border-4 border-black bg-neutral-100 text-black">
          <CardHeader>
            <CardTitle>Historial de recargas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-danger">{topupError}</CardContent>
        </Card>
      ) : (
        <UserTopupsTable topups={topups} />
      )}
    </div>
  );
}
