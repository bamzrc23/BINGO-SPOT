import type { GameRoundStatus } from "@/types/domain";

export const GAME_ROUND_DEFAULT_LUCKY_BALL_PROBABILITY = 0.12;
export const GAME_ROUND_DEFAULT_EXTRA_SPINS_P1 = 0.7;
export const GAME_ROUND_DEFAULT_EXTRA_SPINS_P2 = 0.22;
export const GAME_ROUND_DEFAULT_EXTRA_SPINS_P3 = 0.08;
export const GAME_ROUNDS_DEFAULT_LIMIT = 10;

export const GAME_ROUND_STATUS_LABELS: Record<GameRoundStatus, string> = {
  scheduled: "Programada",
  active: "Activa",
  finished: "Finalizada"
};
