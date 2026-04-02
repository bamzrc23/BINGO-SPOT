import type { AccountStatus, AppRole } from "@/types/domain";

export const ADMIN_ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  pending: "Pendiente",
  active: "Activa",
  suspended: "Suspendida"
};

export const ADMIN_ROLE_LABELS: Record<AppRole, string> = {
  user: "Usuario",
  admin: "Administrador"
};

export const ADMIN_DEFAULT_GAME_SETTINGS: Array<{
  key: string;
  description: string;
  value: number;
}> = [
  {
    key: "bingo.stake.basic.unit_price",
    description: "Precio por tabla nivel Basico",
    value: 0.1
  },
  {
    key: "bingo.stake.plus.unit_price",
    description: "Precio por tabla nivel Plus",
    value: 0.2
  },
  {
    key: "bingo.stake.pro.unit_price",
    description: "Precio por tabla nivel Pro",
    value: 0.4
  },
  {
    key: "bingo.stake.max.unit_price",
    description: "Precio por tabla nivel Max",
    value: 1
  },
  {
    key: "bingo.stake.basic.base_prize_multiplier",
    description: "Multiplicador de premio base nivel Basico",
    value: 1
  },
  {
    key: "bingo.stake.plus.base_prize_multiplier",
    description: "Multiplicador de premio base nivel Plus",
    value: 2.2
  },
  {
    key: "bingo.stake.pro.base_prize_multiplier",
    description: "Multiplicador de premio base nivel Pro",
    value: 4.8
  },
  {
    key: "bingo.stake.max.base_prize_multiplier",
    description: "Multiplicador de premio base nivel Max",
    value: 12
  },
  {
    key: "bingo.stake.basic.cashback_rate",
    description: "Cashback anti-frustracion nivel Basico (compra 25+ sin premio)",
    value: 0.08
  },
  {
    key: "bingo.stake.plus.cashback_rate",
    description: "Cashback anti-frustracion nivel Plus (compra 25+ sin premio)",
    value: 0.09
  },
  {
    key: "bingo.stake.pro.cashback_rate",
    description: "Cashback anti-frustracion nivel Pro (compra 25+ sin premio)",
    value: 0.1
  },
  {
    key: "bingo.stake.max.cashback_rate",
    description: "Cashback anti-frustracion nivel Max (compra 25+ sin premio)",
    value: 0.12
  },
  {
    key: "bingo.default_line_base_prize",
    description: "Premio base por linea",
    value: 0.2
  },
  {
    key: "bingo.default_lucky_ball_probability",
    description: "Probabilidad base bola de la suerte",
    value: 0.15
  },
  {
    key: "bingo.default_draw_interval_seconds",
    description: "Intervalo visual por giro (segundos)",
    value: 6
  }
];

export const ADMIN_ROLE_PERMISSION_MATRIX: Array<{
  role: AppRole;
  capabilities: string[];
}> = [
  {
    role: "admin",
    capabilities: [
      "Gestionar usuarios y estado de cuentas",
      "Aprobar/rechazar recargas y retiros",
      "Crear/activar/finalizar partidas",
      "Liquidar premios y revisar ganadores",
      "Configurar parametros del juego",
      "Ver auditoria y metricas operativas"
    ]
  },
  {
    role: "user",
    capabilities: [
      "Comprar tablas y jugar partidas",
      "Solicitar recargas y retiros",
      "Ver su saldo e historial propio"
    ]
  }
];
