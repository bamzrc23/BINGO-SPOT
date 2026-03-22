import type { PaymentProvider, TopupStatus } from "@/types/domain";

export const TOPUP_RECEIPTS_BUCKET = "topup-receipts";
export const TOPUP_RECEIPTS_SIGNED_URL_SECONDS = 60 * 15;
export const TOPUP_HISTORY_DEFAULT_LIMIT = 30;
export const TOPUP_REVIEW_DEFAULT_LIMIT = 50;

export const TOPUP_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  payphone: "Pago externo",
  bank_transfer: "Transferencia"
};

export const TOPUP_STATUS_LABELS: Record<TopupStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada"
};
