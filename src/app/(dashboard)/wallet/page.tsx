import Link from "next/link";
import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWalletSnapshotByUserId } from "@/modules/wallet/application";
import { WalletBalanceCard, WalletTransactionsTable } from "@/modules/wallet/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default async function WalletPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  let snapshot: Awaited<ReturnType<typeof getWalletSnapshotByUserId>> | null = null;
  let walletError: string | null = null;

  try {
    snapshot = await getWalletSnapshotByUserId(user.id, { limit: 120 });
  } catch (error) {
    walletError = error instanceof Error ? error.message : "No se pudo cargar la billetera.";
  }

  if (!snapshot) {
    return (
      <Card className="rounded-[22px] border-4 border-black bg-neutral-100 text-black">
        <CardHeader>
          <CardTitle>Billetera</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-danger">{walletError}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={ROUTES.topups}
          className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-black bg-black px-4 text-sm font-bold text-white transition hover:bg-black/90"
        >
          RECARGAR
        </Link>
        <Link
          href={ROUTES.withdrawals}
          className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-black bg-white px-4 text-sm font-bold text-black transition hover:bg-neutral-100"
        >
          RETIRAR
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <WalletBalanceCard wallet={snapshot.wallet} />
        <Card className="rounded-[22px] border-4 border-black bg-neutral-100 text-black lg:col-span-2">
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Los movimientos se registran de forma inmutable y cada operacion conserva saldo
            antes y despues para auditoria.
          </CardContent>
        </Card>
      </div>

      <WalletTransactionsTable transactions={snapshot.transactions} />
    </div>
  );
}
