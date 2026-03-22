import { Badge } from "@/components/ui";
import { WITHDRAWAL_STATUS_LABELS } from "@/modules/withdrawals/domain";
import type { WithdrawalStatus } from "@/types/domain";

type WithdrawalStatusBadgeProps = {
  status: WithdrawalStatus;
};

export function WithdrawalStatusBadge({ status }: WithdrawalStatusBadgeProps) {
  const variant =
    status === "paid"
      ? "success"
      : status === "rejected"
        ? "danger"
        : status === "approved"
          ? "default"
          : "default";

  return <Badge variant={variant}>{WITHDRAWAL_STATUS_LABELS[status]}</Badge>;
}
