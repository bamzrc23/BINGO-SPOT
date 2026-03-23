import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWithdrawalsByUserId } from "@/modules/withdrawals/application/withdrawal.service";
import {
  UserWithdrawalsTable,
  WithdrawalRequestForm,
  WithdrawalRulesInfo
} from "@/modules/withdrawals/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default async function WithdrawalsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  let withdrawals = [] as Awaited<ReturnType<typeof getWithdrawalsByUserId>>;
  let withdrawalsError: string | null = null;

  try {
    withdrawals = await getWithdrawalsByUserId(user.id, { limit: 40 });
  } catch (error) {
    withdrawalsError =
      error instanceof Error ? error.message : "No se pudo cargar el historial de retiros.";
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <WithdrawalRequestForm />
        <WithdrawalRulesInfo />
      </div>

      {withdrawalsError ? (
        <Card className="rounded-[22px] border-4 border-black bg-neutral-100 text-black">
          <CardHeader>
            <CardTitle>Historial de retiros</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-danger">{withdrawalsError}</CardContent>
        </Card>
      ) : (
        <UserWithdrawalsTable withdrawals={withdrawals} />
      )}
    </div>
  );
}
