import type { Json } from "@/types/database";
import type { WalletDirection, WalletMovementType } from "@/types/domain";

export type WalletRow = {
  id: string;
  userId: string;
  balance: number;
  lockedBalance: number;
  createdAt: string;
  updatedAt: string;
};

export type WalletTransactionRow = {
  id: string;
  walletId: string;
  userId: string;
  movementType: WalletMovementType;
  direction: WalletDirection;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  operationRef: string | null;
  operationSource: string;
  metadata: Json;
  createdBy: string | null;
  createdAt: string;
};

export type WalletMutationInput = {
  userId: string;
  movementType: WalletMovementType;
  direction: WalletDirection;
  amount: number;
  operationRef?: string;
  operationSource?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
};

export type WalletMutationResult = {
  transactionId: string;
  walletId: string;
  userId: string;
  movementType: WalletMovementType;
  direction: WalletDirection;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  operationRef: string | null;
  createdAt: string;
  wasAlreadyProcessed: boolean;
};

export type WalletSnapshot = {
  wallet: WalletRow;
  transactions: WalletTransactionRow[];
};
