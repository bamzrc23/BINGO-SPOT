import type { BingoLineType } from "@/types/domain";
import type { Json } from "@/types/database";

export type GameRoundLineWinRow = {
  id: string;
  gameRoundId: string;
  boardId: string;
  purchaseId: string;
  userId: string;
  lineType: BingoLineType;
  lineNumbers: number[];
  appliedMultiplier: number;
  basePrize: number;
  prizeAmount: number;
  walletTransactionId: string | null;
  operationRef: string;
  paidAt: string | null;
  createdAt: string;
};

export type GameRoundPrizeRunRow = {
  id: string;
  gameRoundId: string;
  executedBy: string | null;
  basePrize: number;
  linesPaid: number;
  totalPaid: number;
  metadata: Json;
  createdAt: string;
};

export type SettleGameRoundPrizesInput = {
  gameRoundId: string;
  basePrize: number;
  metadata?: Record<string, unknown>;
};

export type SettledLinePrizeRow = {
  lineWinId: string;
  userId: string;
  boardId: string;
  lineType: BingoLineType;
  lineNumbers: number[];
  appliedMultiplier: number;
  basePrize: number;
  prizeAmount: number;
  walletTransactionId: string;
};
