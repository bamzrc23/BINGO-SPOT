import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import type { WalletRow } from "@/modules/wallet/domain";

type WalletBalanceCardProps = {
  wallet: WalletRow;
};

export function WalletBalanceCard({ wallet }: WalletBalanceCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saldo disponible</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-3xl font-semibold tracking-tight">{formatCurrency(wallet.balance)}</p>
        <p className="text-sm text-muted-foreground">
          Saldo bloqueado: {formatCurrency(wallet.lockedBalance)}
        </p>
      </CardContent>
    </Card>
  );
}
