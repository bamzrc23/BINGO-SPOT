import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { BingoBoardGrid } from "@/modules/game/ui/bingo-board-grid";
import type { BoardPurchaseWithBoards } from "@/modules/game/domain";

type BoardPurchasesHistoryProps = {
  purchases: BoardPurchaseWithBoards[];
};

export function BoardPurchasesHistory({ purchases }: BoardPurchasesHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tablas compradas</CardTitle>
      </CardHeader>
      <CardContent>
        {purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavia no has comprado tablas en esta cuenta.
          </p>
        ) : (
          <div className="space-y-6">
            {purchases.map((purchase) => (
              <div key={purchase.id} className="space-y-3 rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-semibold">
                      Compra #{purchase.id.slice(0, 8)} - {purchase.quantity} tabla(s)
                    </p>
                    <p className="text-muted-foreground">
                      {formatDateTime(purchase.createdAt)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">Total: {formatCurrency(purchase.totalAmount)}</p>
                    <p className="text-muted-foreground">Estado: {purchase.status}</p>
                  </div>
                </div>

                {purchase.boards.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aun no hay tablas asociadas a esta compra.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {purchase.boards.map((board) => (
                      <div key={board.id} className="space-y-2 rounded-lg border border-border p-2">
                        <p className="text-xs text-muted-foreground">Tabla #{board.boardIndex}</p>
                        <BingoBoardGrid grid={board.grid} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
