import type { BoardPurchaseStatus } from "@/types/domain";
import type { Json } from "@/types/database";

export type BingoGrid = [
  [number, number, number],
  [number, number, number],
  [number, number, number]
];

export type BoardPurchaseRow = {
  id: string;
  userId: string;
  gameId: string | null;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  status: BoardPurchaseStatus;
  walletTransactionId: string;
  operationRef: string;
  metadata: Json;
  createdAt: string;
  updatedAt: string;
};

export type BingoBoardRow = {
  id: string;
  purchaseId: string;
  userId: string;
  gameId: string | null;
  boardIndex: number;
  boardFingerprint: string;
  grid: BingoGrid;
  createdAt: string;
};

export type PurchaseBoardRpcRow = {
  purchaseId: string;
  boardId: string;
  boardIndex: number;
  boardFingerprint: string;
  grid: BingoGrid;
  walletTransactionId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
};

export type BoardPurchaseWithBoards = BoardPurchaseRow & {
  boards: BingoBoardRow[];
};

export type GameRoundSalesSummary = {
  gameRoundId: string;
  purchasesCount: number;
  boardsSold: number;
  totalSales: number;
};

export type PurchaseBoardsInput = {
  quantity: 1 | 5 | 25 | 100;
  requestRef?: string;
  metadata?: Record<string, unknown>;
};

export type FieldErrors = Record<string, string[] | undefined>;

export type GameFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: FieldErrors;
};

export const INITIAL_GAME_FORM_STATE: GameFormState = {
  status: "idle"
};
