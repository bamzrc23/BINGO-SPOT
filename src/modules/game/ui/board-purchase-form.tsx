"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { cn, formatDateTime } from "@/lib/utils";
import { purchaseBoardsAction } from "@/modules/game/application";
import { BOARD_ALLOWED_QUANTITIES, BOARD_UNIT_PRICE, INITIAL_GAME_FORM_STATE } from "@/modules/game/domain";
import { BoardFieldError } from "@/modules/game/ui/board-field-error";
import { BoardFormFeedback } from "@/modules/game/ui/board-form-feedback";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

type BoardPurchaseFormProps = {
  upcomingGameId?: string | null;
  upcomingGameScheduledAt?: string | null;
  isPurchaseBlocked?: boolean;
  blockedReason?: string | null;
  onPurchaseCompleted?: () => void;
  variant?: "card" | "embedded";
};

export function BoardPurchaseForm({
  upcomingGameId = null,
  upcomingGameScheduledAt = null,
  isPurchaseBlocked = false,
  blockedReason = null,
  onPurchaseCompleted,
  variant = "card"
}: BoardPurchaseFormProps) {
  const [state, formAction, isPending] = useActionState(
    purchaseBoardsAction,
    INITIAL_GAME_FORM_STATE
  );
  const isDisabled = isPending || isPurchaseBlocked || !upcomingGameId;
  const [showFeedback, setShowFeedback] = useState(false);
  const wasPendingRef = useRef(false);

  useEffect(() => {
    const hasMessage = Boolean(state.message) && state.status !== "idle";
    if (!hasMessage) {
      setShowFeedback(false);
      return;
    }

    setShowFeedback(true);
    const timer = window.setTimeout(() => {
      setShowFeedback(false);
    }, 3500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [state.message, state.status]);

  useEffect(() => {
    if (isPending) {
      wasPendingRef.current = true;
      return;
    }

    if (!wasPendingRef.current) {
      return;
    }

    wasPendingRef.current = false;
    if (state.status === "success") {
      onPurchaseCompleted?.();
    }
  }, [isPending, onPurchaseCompleted, state.status]);

  const feedbackState = showFeedback ? state : INITIAL_GAME_FORM_STATE;

  if (variant === "embedded") {
    return (
      <div className="rounded-[20px] border-4 border-black bg-neutral-100 p-4 text-black">
        <p className="text-center text-sm font-bold uppercase tracking-wide">
          Aqui para comprar las tablas
        </p>
        <form action={formAction} className="mt-2 space-y-2">
          

          {isPurchaseBlocked ? (
            <p className="text-sm font-semibold text-red-600">
              {blockedReason ??
                "La partida actual ya inicio. Debes esperar a la siguiente ronda para comprar."}
            </p>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div>
              <select
                id="quantity"
                name="quantity"
                defaultValue={String(BOARD_ALLOWED_QUANTITIES[0])}
                disabled={isDisabled}
                className={cn(
                  "h-11 w-full rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none",
                  isDisabled ? "cursor-not-allowed opacity-60" : null
                )}
              >
                {BOARD_ALLOWED_QUANTITIES.map((quantity) => (
                  <option key={quantity} value={quantity}>
                    {quantity} tabla(s) - ${(quantity * BOARD_UNIT_PRICE).toFixed(2)}
                  </option>
                ))}
              </select>
              <BoardFieldError errors={state.fieldErrors?.quantity} />
            </div>
            <Button
              type="submit"
              disabled={isDisabled}
              className={cn(
                "h-11 rounded-xl border-2 border-black bg-black px-4 font-bold text-white hover:bg-black/90",
                isDisabled ? "opacity-60" : null
              )}
            >
              {isPending ? "Procesando..." : "Comprar"}
            </Button>
          </div>

          <BoardFormFeedback state={feedbackState} />
        </form>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comprar tablas</CardTitle>
        <CardDescription>
          Cada tabla cuesta ${BOARD_UNIT_PRICE.toFixed(2)}. Puedes comprar 1, 5, 25 o 100 tablas por
          transaccion. La compra se asigna automaticamente a la proxima partida programada.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-3 text-sm">
            {upcomingGameId ? (
              <>
                <p className="font-medium">Partida objetivo automatica: #{upcomingGameId.slice(0, 8)}</p>
                <p className="text-muted-foreground">
                  Inicio programado:{" "}
                  {upcomingGameScheduledAt ? formatDateTime(upcomingGameScheduledAt) : "pendiente"}.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                No hay una partida programada disponible para recibir compras.
              </p>
            )}
          </div>

          {isPurchaseBlocked ? (
            <p className="text-sm font-medium text-danger">
              {blockedReason ??
                "La partida actual ya inicio. Debes esperar a la siguiente ronda para comprar."}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="quantity" className="text-sm font-medium">
              Cantidad de tablas
            </label>
            <select
              id="quantity"
              name="quantity"
              defaultValue={String(BOARD_ALLOWED_QUANTITIES[0])}
              disabled={isDisabled}
              className="flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {BOARD_ALLOWED_QUANTITIES.map((quantity) => (
                <option key={quantity} value={quantity}>
                  {quantity} tabla(s) - ${(quantity * BOARD_UNIT_PRICE).toFixed(2)}
                </option>
              ))}
            </select>
            <BoardFieldError errors={state.fieldErrors?.quantity} />
          </div>

          <BoardFormFeedback state={feedbackState} />

          <Button type="submit" disabled={isDisabled}>
            {isPending ? "Generando tablas..." : "Comprar y generar tablas"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
