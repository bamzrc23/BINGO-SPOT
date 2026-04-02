import type { User } from "@supabase/supabase-js";

import type { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeNickname } from "@/modules/auth/domain";
import type { Database } from "@/types/database";

type AppSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

function readString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim();
}

function fallbackNickname(user: User): string {
  const base = user.email?.split("@")[0] ?? `user_${user.id.slice(0, 8)}`;
  return sanitizeNickname(base.replace(/[^a-zA-Z0-9_]/g, "_"));
}

export async function ensureProfileForUser(
  client: AppSupabaseClient,
  user: User
): Promise<ProfileRow | null> {
  const existingProfileResult = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfileResult.error) {
    console.error("profiles.select error", existingProfileResult.error);
    return null;
  }

  if (existingProfileResult.data) {
    return existingProfileResult.data;
  }

  const metadata = user.user_metadata ?? {};
  const firstName = readString(metadata.first_name, "Jugador");
  const lastName = readString(metadata.last_name, "Bingo");
  const phone = readString(metadata.phone, "") || null;
  const nicknameCandidate = readString(metadata.nickname, fallbackNickname(user));
  const nickname = sanitizeNickname(nicknameCandidate) || fallbackNickname(user);

  const insertPayload: Database["public"]["Tables"]["profiles"]["Insert"] = {
    id: user.id,
    first_name: firstName,
    last_name: lastName,
    nickname,
    email: user.email ?? `${fallbackNickname(user)}@invalid.local`,
    phone,
    role: "user",
    account_status: "active"
  };

  const upsertResult = await client.from("profiles").upsert(insertPayload as never, {
    onConflict: "id",
    ignoreDuplicates: true
  });

  if (upsertResult.error) {
    console.error("profiles.upsert error", upsertResult.error);
    return null;
  }

  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getProfileByUserId(client: AppSupabaseClient, userId: string) {
  return client.from("profiles").select("*").eq("id", userId).maybeSingle();
}

export async function updateProfileByUserId(
  client: AppSupabaseClient,
  userId: string,
  payload: ProfileUpdate
) {
  return client
    .from("profiles")
    .update(payload as never)
    .eq("id", userId)
    .select("*")
    .single();
}
