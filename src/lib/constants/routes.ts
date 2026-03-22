export const ROUTES = {
  home: "/",
  register: "/register",
  login: "/login",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  dashboard: "/dashboard",
  game: "/game",
  history: "/history",
  wallet: "/wallet",
  topups: "/topups",
  withdrawals: "/withdrawals",
  profile: "/profile",
  admin: "/admin",
  adminUsers: "/admin/users",
  adminTopups: "/admin/topups",
  adminWithdrawals: "/admin/withdrawals",
  adminGames: "/admin/games",
  adminSettings: "/admin/settings",
  adminAudit: "/admin/audit"
} as const;

export const AUTH_ROUTES = [ROUTES.login, ROUTES.register, ROUTES.forgotPassword] as const;
export const PUBLIC_ROUTES = [ROUTES.home, ...AUTH_ROUTES, ROUTES.resetPassword] as const;
export const PROTECTED_ROUTE_PREFIXES = [
  ROUTES.dashboard,
  ROUTES.profile,
  ROUTES.wallet,
  ROUTES.topups,
  ROUTES.withdrawals,
  ROUTES.history,
  ROUTES.game
] as const;
export const ADMIN_ROUTE_PREFIX = ROUTES.admin;

export const DEFAULT_REDIRECTS = {
  afterLogin: ROUTES.dashboard,
  notAuthorized: ROUTES.dashboard
} as const;
