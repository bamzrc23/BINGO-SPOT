"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/lib/constants/routes";
import { purchaseBoardsForUser } from "@/modules/game/application/board.service";
import { INITIAL_GAME_FORM_STATE, type GameFormState } from "@/modules/game/domain";

function buildErrorState(message: string, fieldErrors?: Record<string, string[] | undefined>) {
  return {
    status: "error",
    message,
    fieldErrors
  } satisfies GameFormState;
}

function buildSuccessState(message: string) {
  return {
    status: "success",
    message
  } satisfies GameFormState;
}

function parseStringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function purchaseBoardsAction(
  _previousState: GameFormState = INITIAL_GAME_FORM_STATE,
  formData: FormData
): Promise<GameFormState> {
  try {
    const quantityRaw = parseStringField(formData, "quantity");
    const requestRef = parseStringField(formData, "requestRef");

    const rows = await purchaseBoardsForUser({
      quantity: Number(quantityRaw) as 1 | 5 | 25 | 100,
      requestRef: requestRef || undefined
    });

    const first = rows[0];
    const quantity = first?.quantity ?? 0;
    const total = first?.totalAmount ?? 0;

    // La sala se sincroniza por realtime/callback local; revalidamos solo la ruta de juego.
    revalidatePath(ROUTES.game);

    return buildSuccessState(
      `Compra completada: ${quantity} tabla(s) por $${total.toFixed(2)}.`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo comprar tablas.";
    return buildErrorState(message);
  }
}
