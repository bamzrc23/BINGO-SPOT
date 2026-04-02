export const BOARD_UNIT_PRICE = 0.1;
export const BOARD_ALLOWED_QUANTITIES = [1, 5, 25, 100] as const;
export const BOARD_PURCHASES_DEFAULT_LIMIT = 10;
export const BOARD_HISTORY_DEFAULT_LIMIT = 150;

export const BOARD_STAKE_TIERS = ["basic", "plus", "pro", "max"] as const;

export const BOARD_STAKE_CONFIG = {
  basic: {
    label: "Basico",
    unitPrice: 0.1,
    basePrizeMultiplier: 1,
    cashbackRate: 0.08
  },
  plus: {
    label: "Plus",
    unitPrice: 0.2,
    basePrizeMultiplier: 2.2,
    cashbackRate: 0.09
  },
  pro: {
    label: "Pro",
    unitPrice: 0.4,
    basePrizeMultiplier: 4.8,
    cashbackRate: 0.1
  },
  max: {
    label: "Max",
    unitPrice: 1,
    basePrizeMultiplier: 12,
    cashbackRate: 0.12
  }
} as const;

export const BOARD_DEFAULT_STAKE_TIER = "basic" as const;
