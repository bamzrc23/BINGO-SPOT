import type { Json } from "@/types/database";
import type { AccountStatus, AppRole, WalletDirection, WalletMovementType } from "@/types/domain";

export type AdminDashboardMetrics = {
  usersTotal: number;
  usersActive: number;
  usersSuspended: number;
  topupsPending: number;
  withdrawalsPending: number;
  activeRoundId: string | null;
  boardsSoldTotal: number;
  boardsRevenueTotal: number;
  prizesPaidTotal: number;
  netGamingResultTotal: number;
  boardSalesBreakdown: AdminBoardSalesBreakdown[];
};

export type AdminBoardSalesBreakdown = {
  stakeTier: string;
  unitPrice: number;
  purchasesCount: number;
  boardsSold: number;
  salesTotal: number;
};

export type AdminUserWithWallet = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  email: string;
  phone: string | null;
  role: AppRole;
  accountStatus: AccountStatus;
  createdAt: string;
  walletBalance: number;
  walletLockedBalance: number;
  walletUpdatedAt: string | null;
  walletTxCount: number;
  lastWalletTxAt: string | null;
};

export type AdminWalletTransaction = {
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

export type GameSettingRow = {
  key: string;
  value: Json;
  description: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminAuditLogRow = {
  id: string;
  actorUserId: string | null;
  actorNickname: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: Json;
  createdAt: string;
};

export type AdminUsersQueryInput = {
  search?: string;
  role?: AppRole;
  accountStatus?: AccountStatus;
  limit?: number;
  offset?: number;
};

export type AdminAuditQueryInput = {
  action?: string;
  entityType?: string;
  limit?: number;
  offset?: number;
};

export type AdminSetUserStatusInput = {
  userId: string;
  accountStatus: AccountStatus;
  reason?: string;
};

export type AdminUpsertGameSettingInput = {
  key: string;
  valueRaw: string;
  description?: string;
};

export type AdminFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const INITIAL_ADMIN_FORM_STATE: AdminFormState = {
  status: "idle"
};
