import { getBankTransferTopupsForAdmin } from "@/modules/payments/application/topups.service";
import { AdminBankTransferTopupsTable, TopupsRealtimeSync } from "@/modules/payments/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default async function AdminTopupsPage() {
  let topups = [] as Awaited<ReturnType<typeof getBankTransferTopupsForAdmin>>;
  let topupError: string | null = null;

  try {
    topups = await getBankTransferTopupsForAdmin({ limit: 80 });
  } catch (error) {
    topupError =
      error instanceof Error ? error.message : "No se pudo cargar la bandeja de recargas.";
  }

  if (topupError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recargas</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-danger">{topupError}</CardContent>
      </Card>
    );
  }

  return (
    <>
      <TopupsRealtimeSync />
      <AdminBankTransferTopupsTable topups={topups} />
    </>
  );
}
