import type { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AppSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

type SignUpInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  emailRedirectTo: string;
};

export async function signInWithPassword(
  client: AppSupabaseClient,
  email: string,
  password: string
) {
  return client.auth.signInWithPassword({
    email,
    password
  });
}

export async function signUpWithPassword(client: AppSupabaseClient, input: SignUpInput) {
  return client.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: input.emailRedirectTo,
      data: {
        first_name: input.firstName,
        last_name: input.lastName,
        nickname: input.nickname,
        phone: input.phone,
        role: "user",
        account_status: "active"
      }
    }
  });
}

export async function sendPasswordRecoveryEmail(
  client: AppSupabaseClient,
  email: string,
  redirectTo: string
) {
  return client.auth.resetPasswordForEmail(email, {
    redirectTo
  });
}
