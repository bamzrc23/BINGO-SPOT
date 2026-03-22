import type { WalletDirection, WalletMovementType } from "@/types/domain";

export const WALLET_MOVEMENT_LABELS: Record<WalletMovementType, string> = {
  topup: "Recarga",
  prize: "Premio",
  board_purchase: "Compra de tablas",
  withdrawal: "Retiro",
  admin_adjustment: "Ajuste admin"
};

export const WALLET_DIRECTION_LABELS: Record<WalletDirection, string> = {
  credit: "Credito",
  debit: "Debito"
};
