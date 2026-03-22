import type { Json } from "@/types/database";
import type { GameRoundStatus } from "@/types/domain";
import type { GameRoundLineWinRow, GameRoundPrizeRunRow } from "@/modules/game/domain/prize.types";

export type GameRoundRow = {
  id: string;
  status: GameRoundStatus;
  scheduledAt: string;
  activatedAt: string | null;
  finishedAt: string | null;
  baseDrawCount: number;
  extraDrawCount: number;
  totalDrawCount: number;
  luckyBallProbability: number;
  luckyBallTriggered: boolean;
  luckyBallTriggerOrder: number | null;
  luckyBallExtraSpins: number;
  metadata: Json;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GameRoundMultiplierRow = {
  id: string;
  gameRoundId: string;
  numberValue: number;
  multiplier: 2 | 3 | 5;
  createdAt: string;
};

export type GameRoundDrawRow = {
  id: string;
  gameRoundId: string;
  drawOrder: number;
  numberValue: number;
  isExtraSpin: boolean;
  createdAt: string;
};

export type GameRoundLuckyBallEventRow = {
  id: string;
  gameRoundId: string;
  triggerOrder: number;
  extraSpins: 1 | 2 | 3;
  randomValue: number;
  createdAt: string;
};

export type GameRoundDetail = {
  round: GameRoundRow;
  multipliers: GameRoundMultiplierRow[];
  draws: GameRoundDrawRow[];
  luckyBallEvent: GameRoundLuckyBallEventRow | null;
  lineWins: GameRoundLineWinRow[];
  prizeRuns: GameRoundPrizeRunRow[];
};

export type CreateGameRoundInput = {
  scheduledAt?: string;
  metadata?: Record<string, unknown>;
};

export type ActivateGameRoundInput = {
  gameRoundId: string;
  luckyBallProbability?: number;
  extraSpinsP1?: number;
  extraSpinsP2?: number;
  extraSpinsP3?: number;
  metadata?: Record<string, unknown>;
};

export type FinalizeGameRoundInput = {
  gameRoundId: string;
  metadata?: Record<string, unknown>;
};

export type GameRoundFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const INITIAL_GAME_ROUND_FORM_STATE: GameRoundFormState = {
  status: "idle"
};
