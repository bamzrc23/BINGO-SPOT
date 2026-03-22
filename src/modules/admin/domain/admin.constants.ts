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
    key: "bingo.board_unit_price",
    description: "Precio por tabla",
    value: 0.1
  },
  {
    key: "bingo.default_line_base_prize",
    description: "Premio base por linea",
    value: 0.2
  },
  {
    key: "bingo.default_lucky_ball_probability",
    description: "Probabilidad base bola de la suerte",
    value: 0.12
  },
  {
    key: "bingo.default_draw_interval_seconds",
    description: "Intervalo visual por giro (segundos)",
    value: 5
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
