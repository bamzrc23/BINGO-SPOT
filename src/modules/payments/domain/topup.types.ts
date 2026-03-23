import type { Json } from "@/types/database";
import type { PaymentProvider, TopupEventType, TopupStatus } from "@/types/domain";

export type TopupRow = {
  id: string;
  userId: string;
  provider: PaymentProvider;
  status: TopupStatus;
  amount: number;
  currency: string;
  providerReference: string | null;
  clientReference: string | null;
  receiptPath: string | null;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  walletTransactionId: string | null;
  metadata: Json;
  createdAt: string;
  updatedAt: string;
};

export type TopupEventRow = {
  id: string;
  topupId: string;
  actorUserId: string | null;
  eventType: TopupEventType;
  previousStatus: TopupStatus | null;
  currentStatus: TopupStatus;
  notes: string | null;
  payload: Json;
  createdAt: string;
};

export type TopupRowWithReceiptUrl = TopupRow & {
  receiptSignedUrl: string | null;
};

export type CreatePayphoneTopupInput = {
  amount: number;
  clientReference?: string;
  payload?: Record<string, unknown>;
};

export type CreateBankTransferTopupInput = {
  amount: number;
  clientReference?: string;
  receiptPath?: string | null;
  payload?: Record<string, unknown>;
};

export type ReviewBankTransferTopupInput = {
  topupId: string;
  decision: "approved" | "rejected";
  rejectionReason?: string;
  payload?: Record<string, unknown>;
};

export type ApplyPayphoneResultInput = {
  topupId: string;
  approved: boolean;
  providerReference?: string;
  rejectionReason?: string;
  payload?: Record<string, unknown>;
};

export type FieldErrors = Record<string, string[] | undefined>;

export type TopupFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: FieldErrors;
  verificationCode?: string;
  redirectUrl?: string;
};

export const INITIAL_TOPUP_FORM_STATE: TopupFormState = {
  status: "idle"
};
