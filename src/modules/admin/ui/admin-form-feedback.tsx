import type { AdminFormState } from "@/modules/admin/domain";

type AdminFormFeedbackProps = {
  state: AdminFormState;
};

export function AdminFormFeedback({ state }: AdminFormFeedbackProps) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
    <p className={state.status === "error" ? "text-sm text-danger" : "text-sm text-success"}>
      {state.message}
    </p>
  );
}
