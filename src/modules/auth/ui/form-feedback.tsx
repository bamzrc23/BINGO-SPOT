import type { AuthFormState } from "@/modules/auth/domain";
import { cn } from "@/lib/utils";

type FormFeedbackProps = {
  state: AuthFormState;
};

export function FormFeedback({ state }: FormFeedbackProps) {
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
