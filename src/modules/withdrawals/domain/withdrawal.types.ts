import type { Json } from "@/types/database";
import type {
  BankAccountType,
  WithdrawalEventType,
  WithdrawalStatus
} from "@/types/domain";

export type WithdrawalFeeRuleRow = {
  id: string;
  bankNormalized: string;
  fee: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WithdrawalRow = {
  id: string;
  userId: string;
  bankName: string;
  bankNormalized: string;
  accountType: BankAccountType;
  accountNumber: string;
  accountHolderName: string;
  accountHolderId: string;
  amountRequested: number;
  feeApplied: number;
  amountNet: number;
  lockedAmount: number;
  status: WithdrawalStatus;
  adminObservation: string | null;
  rejectionReason: string | null;
  reviewedBy: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  rejectedAt: string | null;
  walletTransactionId: string | null;
  externalReference: string | null;
  metadata: Json;
  createdAt: string;
  updatedAt: string;
};

export type WithdrawalEventRow = {
  id: string;
  withdrawalId: string;
  actorUserId: string | null;
  eventType: WithdrawalEventType;
  previousStatus: WithdrawalStatus | null;
  currentStatus: WithdrawalStatus;
  notes: string | null;
  payload: Json;
  createdAt: string;
};

export type WithdrawalFeeQuote = {
  bankNormalized: string;
  feeApplied: number;
  amountNet: number;
};

export type CreateWithdrawalRequestInput = {
  bankName: string;
  accountType: BankAccountType;
  accountNumber: string;
  accountHolderName: string;
  accountHolderId: string;
  amountRequested: number;
  metadata?: Record<string, unknown>;
};

export type ReviewWithdrawalInput = {
  withdrawalId: string;
  decision: "approved" | "rejected";
  observation?: string;
  rejectionReason?: string;
  payload?: Record<string, unknown>;
};

export type MarkWithdrawalPaidInput = {
  withdrawalId: string;
  observation?: string;
  externalReference?: string;
  payload?: Record<string, unknown>;
};

export type FieldErrors = Record<string, string[] | undefined>;

export type WithdrawalFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: FieldErrors;
  verificationCode?: string;
  redirectUrl?: string;
};

export const INITIAL_WITHDRAWAL_FORM_STATE: WithdrawalFormState = {
  status: "idle"
};
