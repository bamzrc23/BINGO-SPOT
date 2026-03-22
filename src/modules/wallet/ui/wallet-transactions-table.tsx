import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  WALLET_DIRECTION_LABELS,
  WALLET_MOVEMENT_LABELS,
  type WalletTransactionRow
} from "@/modules/wallet/domain";

type WalletTransactionsTableProps = {
  transactions: WalletTransactionRow[];
};

export function WalletTransactionsTable({ transactions }: WalletTransactionsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de movimientos</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay movimientos registrados todavia.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Fecha</th>
                  <th className="px-2 py-2 font-medium">Tipo</th>
                  <th className="px-2 py-2 font-medium">Direccion</th>
                  <th className="px-2 py-2 font-medium">Monto</th>
                  <th className="px-2 py-2 font-medium">Antes</th>
                  <th className="px-2 py-2 font-medium">Despues</th>
                  <th className="px-2 py-2 font-medium">Referencia</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/60 align-top">
                    <td className="px-2 py-2">{formatDateTime(tx.createdAt)}</td>
                    <td className="px-2 py-2">{WALLET_MOVEMENT_LABELS[tx.movementType]}</td>
                    <td className="px-2 py-2">
                      <Badge variant={tx.direction === "credit" ? "success" : "default"}>
                        {WALLET_DIRECTION_LABELS[tx.direction]}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 font-medium">
                      {tx.direction === "credit" ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-2 py-2">{formatCurrency(tx.balanceBefore)}</td>
                    <td className="px-2 py-2">{formatCurrency(tx.balanceAfter)}</td>
                    <td className="px-2 py-2 text-muted-foreground">{tx.operationRef ?? "-"}</td>
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
