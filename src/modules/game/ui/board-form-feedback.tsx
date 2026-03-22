import { cn } from "@/lib/utils";
import type { GameFormState } from "@/modules/game/domain";

type BoardFormFeedbackProps = {
  state: GameFormState;
};

export function BoardFormFeedback({ state }: BoardFormFeedbackProps) {
  if (!state.message || state.status === "idle") {
    return null;
  }

  return (
    <p
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        state.status === "error" && "bg-danger/10 text-danger",
        state.status === "success" && "bg-success/10 text-success"
      )}
    >
      {state.message}
    </p>
  );
}
