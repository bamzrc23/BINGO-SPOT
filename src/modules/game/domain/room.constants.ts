export const GAME_ROOM_DRAW_INTERVAL_SECONDS = 5;
export const GAME_ROOM_WIN_FEEDBACK_DURATION_MS = 4200;
export const GAME_ROOM_POLL_FALLBACK_MS = 15000;
export const GAME_ROOM_PRESTART_ANIMATION_SECONDS = 5;
export const GAME_ROOM_ROUND_COOLDOWN_SECONDS = 30;
export const GAME_ROOM_AUTOMATION_TICK_MS = 3000;

export const GAME_ROOM_STATUS_LABELS = {
  loading: "Cargando",
  waiting: "En espera",
  active: "En juego",
  finished: "Finalizada"
} as const;
