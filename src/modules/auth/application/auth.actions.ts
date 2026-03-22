"use server";

import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";
import { siteConfig } from "@/lib/constants/site";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  profileUpdateSchema,
  registerSchema,
  resetPasswordSchema
} from "@/lib/validation";
import {
  getSafeRedirectPath,
  INITIAL_AUTH_FORM_STATE,
  sanitizeNickname,
  type AuthFormState
} from "@/modules/auth/domain";
import {
  ensureProfileForUser,
  sendPasswordRecoveryEmail,
  signInWithPassword,
  signUpWithPassword,
  updateProfileByUserId
} from "@/modules/auth/infrastructure";

function buildErrorState(
  message: string,
  fieldErrors?: Record<string, string[] | undefined>
): AuthFormState {
  return {
    status: "error",
    message,
    fieldErrors
  };
}

function buildSuccessState(message: string): AuthFormState {
  return {
    status: "success",
    message
  };
}

function parseStringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function registerAction(
  _previousState: AuthFormState = INITIAL_AUTH_FORM_STATE,
  formData: FormData
): Promise<AuthFormState> {
  const payload = {
    firstName: parseStringField(formData, "firstName"),
    lastName: parseStringField(formData, "lastName"),
    nickname: parseStringField(formData, "nickname"),
    email: parseStringField(formData, "email"),
    phone: parseStringField(formData, "phone"),
    password: parseStringField(formData, "password"),
    confirmPassword: parseStringField(formData, "confirmPassword")
  };

  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) {
    return buildErrorState("Corrige los errores del formulario.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createServerSupabaseClient();
  const normalizedNickname = sanitizeNickname(parsed.data.nickname);

  const { data: existingNickname } = await supabase
    .from("profiles")
    .select("id")
    .ilike("nickname", normalizedNickname)
    .maybeSingle();

  if (existingNickname) {
    return buildErrorState("El usuario ya esta en uso.", {
      nickname: ["Elige otro usuario o nickname."]
    });
  }

  const callbackUrl = `${siteConfig.url}/auth/callback?next=${encodeURIComponent(ROUTES.dashboard)}`;

  const { data, error } = await signUpWithPassword(supabase, {
    ...parsed.data,
    nickname: normalizedNickname,
    phone: parsed.data.phone ?? "",
    emailRedirectTo: callbackUrl
  });

  if (error) {
    return buildErrorState(error.message);
  }

  if (data.user) {
    await ensureProfileForUser(supabase, data.user);
  }

  if (data.session) {
    redirect(ROUTES.dashboard);
  }

  return buildSuccessState(
    "Registro completado. Revisa tu correo para confirmar la cuenta si la verificacion por email esta activa."
  );
}

export async function loginAction(
  _previousState: AuthFormState = INITIAL_AUTH_FORM_STATE,
  formData: FormData
): Promise<AuthFormState> {
  const payload = {
    email: parseStringField(formData, "email"),
    password: parseStringField(formData, "password")
  };

  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    return buildErrorState("Corrige los errores del formulario.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await signInWithPassword(
    supabase,
    parsed.data.email,
    parsed.data.password
  );

  if (error) {
    return buildErrorState("Credenciales invalidas.");
  }

  if (data.user) {
    const profile = await ensureProfileForUser(supabase, data.user);
    if (!profile) {
      return buildErrorState("No se pudo cargar tu perfil. Intenta nuevamente.");
    }

    if (profile.account_status !== "active") {
      await supabase.auth.signOut();
      return buildErrorState("Tu cuenta no esta activa. Contacta al soporte.");
    }
  }

  const safeNextPath = getSafeRedirectPath(parseStringField(formData, "next"));
  redirect(safeNextPath);
}

export async function forgotPasswordAction(
  _previousState: AuthFormState = INITIAL_AUTH_FORM_STATE,
  formData: FormData
): Promise<AuthFormState> {
  const payload = {
    email: parseStringField(formData, "email")
  };

  const parsed = forgotPasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return buildErrorState("Corrige los errores del formulario.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createServerSupabaseClient();
  const redirectTo = `${siteConfig.url}/auth/callback?next=${encodeURIComponent(ROUTES.resetPassword)}`;

  const { error } = await sendPasswordRecoveryEmail(supabase, parsed.data.email, redirectTo);
  if (error) {
    return buildErrorState("No se pudo enviar el correo de recuperacion. Intenta nuevamente.");
  }

  return buildSuccessState(
    "Si el correo existe, enviamos instrucciones de recuperacion a tu bandeja."
  );
}

export async function resetPasswordAction(
  _previousState: AuthFormState = INITIAL_AUTH_FORM_STATE,
  formData: FormData
): Promise<AuthFormState> {
  const payload = {
    password: parseStringField(formData, "password"),
    confirmPassword: parseStringField(formData, "confirmPassword")
  };

  const parsed = resetPasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return buildErrorState("Corrige los errores del formulario.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return buildErrorState("Tu sesion de recuperacion no es valida. Solicita un nuevo enlace.");
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password
  });

  if (error) {
    return buildErrorState("No se pudo actualizar la contrasena. Intenta nuevamente.");
  }

  return buildSuccessState("Contrasena actualizada correctamente. Ya puedes iniciar sesion.");
}

export async function updateProfileAction(
  _previousState: AuthFormState = INITIAL_AUTH_FORM_STATE,
  formData: FormData
): Promise<AuthFormState> {
  const payload = {
    firstName: parseStringField(formData, "firstName"),
    lastName: parseStringField(formData, "lastName"),
    nickname: parseStringField(formData, "nickname"),
    phone: parseStringField(formData, "phone")
  };

  const parsed = profileUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return buildErrorState("Corrige los errores del formulario.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const { error } = await updateProfileByUserId(supabase, user.id, {
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    nickname: sanitizeNickname(parsed.data.nickname),
    phone: parsed.data.phone || null
  });

  if (error) {
    if (error.code === "23505") {
      return buildErrorState("El usuario ya esta en uso.", {
        nickname: ["Elige otro usuario o nickname."]
      });
    }

    return buildErrorState("No se pudo actualizar el perfil.");
  }

  return buildSuccessState("Perfil actualizado correctamente.");
}

export async function logoutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect(ROUTES.login);
}
