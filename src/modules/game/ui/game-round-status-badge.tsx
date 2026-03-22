import { Badge } from "@/components/ui";
import { GAME_ROUND_STATUS_LABELS } from "@/modules/game/domain";
import type { GameRoundStatus } from "@/types/domain";

type GameRoundStatusBadgeProps = {
  status: GameRoundStatus;
};

export function GameRoundStatusBadge({ status }: GameRoundStatusBadgeProps) {
  const variant = status === "finished" ? "success" : status === "active" ? "default" : "default";
  return <Badge variant={variant}>{GAME_ROUND_STATUS_LABELS[status]}</Badge>;
}
