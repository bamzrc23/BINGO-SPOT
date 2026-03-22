import type { User } from "@supabase/supabase-js";

export type AppRole = "user" | "admin";

export function getUserRole(user: User | null | undefined): AppRole {
  if (!user) {
    return "user";
  }

  const role = user.app_metadata?.role ?? user.user_metadata?.role;
  return role === "admin" ? "admin" : "user";
}

export function isPathProtected(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
