import { getWithdrawalsForAdmin } from "@/modules/withdrawals/application/withdrawal.service";
import { AdminWithdrawalsTable } from "@/modules/withdrawals/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default async function AdminWithdrawalsPage() {
  let withdrawals = [] as Awaited<ReturnType<typeof getWithdrawalsForAdmin>>;
  let withdrawalsError: string | null = null;

  try {
    withdrawals = await getWithdrawalsForAdmin({ limit: 120 });
  } catch (error) {
    withdrawalsError =
      error instanceof Error ? error.message : "No se pudo cargar la bandeja de retiros.";
  }

  if (withdrawalsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Retiros</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-danger">{withdrawalsError}</CardContent>
      </Card>
    );
  }

  return <AdminWithdrawalsTable withdrawals={withdrawals} />;
}
