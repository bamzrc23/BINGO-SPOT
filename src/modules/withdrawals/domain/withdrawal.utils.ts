import { getMetadataStringValue } from "@/lib/utils";
import type { WithdrawalRow } from "@/modules/withdrawals/domain/withdrawal.types";

export function getWithdrawalVerificationCode(withdrawal: WithdrawalRow): string | null {
  return getMetadataStringValue(withdrawal.metadata, "verification_code");
}
