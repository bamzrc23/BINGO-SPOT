export type TopupStatus = "pending" | "approved" | "rejected";
export type TopupEventType = "created" | "provider_update" | "approved" | "rejected";
export type WithdrawalStatus = "pending" | "approved" | "paid" | "rejected";
export type WithdrawalEventType = "created" | "approved" | "paid" | "rejected";
export type BankAccountType = "savings" | "checking";
export type BoardPurchaseStatus = "pending" | "completed" | "failed";
export type GameRoundStatus = "scheduled" | "active" | "finished";
export type BingoLineType = "row_1" | "row_2" | "row_3" | "col_1" | "col_2" | "col_3";
export type PaymentProvider = "payphone" | "bank_transfer";
export type AppRole = "user" | "admin";
export type AccountStatus = "pending" | "active" | "suspended";
export type WalletMovementType =
  | "topup"
  | "prize"
  | "board_purchase"
  | "withdrawal"
  | "admin_adjustment";
export type WalletDirection = "credit" | "debit";
