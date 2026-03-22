import type { BankAccountType, WithdrawalStatus } from "@/types/domain";

export const WITHDRAWALS_HISTORY_DEFAULT_LIMIT = 30;
export const WITHDRAWALS_REVIEW_DEFAULT_LIMIT = 60;

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  paid: "Pagado",
  rejected: "Rechazado"
};

export const BANK_ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  savings: "Ahorros",
  checking: "Corriente"
};

export const COMMISSION_FREE_BANKS = new Set(["banco pichincha", "pichincha", "banco guayaquil", "guayaquil"]);
