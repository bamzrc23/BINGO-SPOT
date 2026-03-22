import { getAdminAuditLogs } from "@/modules/admin/application/admin.service";
import { AdminAuditTable } from "@/modules/admin/ui";
import { Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";

type AdminAuditPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAuditPage({ searchParams }: AdminAuditPageProps) {
  const params = (await searchParams) ?? {};
  const action = typeof params.action === "string" ? params.action : "";
  const entityType = typeof params.entityType === "string" ? params.entityType : "";

  let logs = [] as Awaited<ReturnType<typeof getAdminAuditLogs>>;
  let logsError: string | null = null;

  try {
    logs = await getAdminAuditLogs({
      action: action || undefined,
      entityType: entityType || undefined,
      limit: 180
    });
  } catch (error) {
    logsError = error instanceof Error ? error.message : "No se pudo cargar auditoria.";
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filtros de auditoria</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Input name="action" defaultValue={action} placeholder="Buscar por accion" />
            <Input name="entityType" defaultValue={entityType} placeholder="Buscar por entidad" />
            <button
              type="submit"
              className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Aplicar
            </button>
          </form>
        </CardContent>
      </Card>

      {logsError ? (
        <Card>
          <CardContent className="p-4 text-sm text-danger">{logsError}</CardContent>
        </Card>
      ) : (
        <AdminAuditTable logs={logs} />
      )}
    </div>
  );
}
