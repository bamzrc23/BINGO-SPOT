import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import type { AdminAuditLogRow } from "@/modules/admin/domain";

type AdminAuditTableProps = {
  logs: AdminAuditLogRow[];
};

export function AdminAuditTable({ logs }: AdminAuditTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Auditoria</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay eventos de auditoria para los filtros actuales.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Fecha</th>
                  <th className="px-2 py-2 font-medium">Accion</th>
                  <th className="px-2 py-2 font-medium">Entidad</th>
                  <th className="px-2 py-2 font-medium">Actor</th>
                  <th className="px-2 py-2 font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border/60 align-top">
                    <td className="px-2 py-2">{formatDateTime(log.createdAt)}</td>
                    <td className="px-2 py-2 font-medium">{log.action}</td>
                    <td className="px-2 py-2">
                      {log.entityType}
                      {log.entityId ? <p className="text-xs text-muted-foreground">{log.entityId}</p> : null}
                    </td>
                    <td className="px-2 py-2">
                      {log.actorNickname ?? "-"}
                      {log.actorUserId ? (
                        <p className="text-xs text-muted-foreground">{log.actorUserId.slice(0, 8)}...</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">
                      <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-2 text-[11px]">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
