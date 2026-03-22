import { Badge } from "@/components/ui";
import { TOPUP_STATUS_LABELS } from "@/modules/payments/domain";
import type { TopupStatus } from "@/types/domain";

type TopupStatusBadgeProps = {
  status: TopupStatus;
};

export function TopupStatusBadge({ status }: TopupStatusBadgeProps) {
  const variant = status === "approved" ? "success" : status === "rejected" ? "danger" : "default";

  return <Badge variant={variant}>{TOPUP_STATUS_LABELS[status]}</Badge>;
}
