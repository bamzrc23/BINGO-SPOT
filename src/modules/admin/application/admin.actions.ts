"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/lib/constants/routes";
import {
  INITIAL_ADMIN_FORM_STATE,
  type AdminFormState
} from "@/modules/admin/domain";
import {
  setAdminUserStatus,
  upsertAdminGameSetting
} from "@/modules/admin/application/admin.service";

function buildErrorState(message: string, fieldErrors?: Record<string, string[] | undefined>) {
  return {
    status: "error",
    message,
    fieldErrors
  } satisfies AdminFormState;
}

function buildSuccessState(message: string) {
  return {
    status: "success",
    message
  } satisfies AdminFormState;
}

function parseStringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateUserStatusAction(
  _previousState: AdminFormState = INITIAL_ADMIN_FORM_STATE,
  formData: FormData
): Promise<AdminFormState> {
  try {
    const userId = parseStringField(formData, "userId");
    const accountStatus = parseStringField(formData, "accountStatus") as
      | "pending"
      | "active"
      | "suspended";
    const reason = parseStringField(formData, "reason");

    await setAdminUserStatus({
      userId,
      accountStatus,
      reason: reason || undefined
    });

    revalidatePath(ROUTES.admin);
    revalidatePath(ROUTES.adminUsers);

    return buildSuccessState("Estado de usuario actualizado correctamente.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar el estado del usuario.";
    return buildErrorState(message);
  }
}

export async function upsertGameSettingAction(
  _previousState: AdminFormState = INITIAL_ADMIN_FORM_STATE,
  formData: FormData
): Promise<AdminFormState> {
  try {
    const key = parseStringField(formData, "key");
    const valueRaw = parseStringField(formData, "valueRaw");
    const description = parseStringField(formData, "description");

    await upsertAdminGameSetting({
      key,
      valueRaw,
      description: description || undefined
    });

    revalidatePath(ROUTES.adminSettings);
    revalidatePath(ROUTES.adminGames);
    revalidatePath(ROUTES.game);

    return buildSuccessState("Configuracion guardada correctamente.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo guardar la configuracion.";
    return buildErrorState(message);
  }
}
