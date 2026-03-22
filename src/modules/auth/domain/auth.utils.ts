import { ROUTES } from "@/lib/constants/routes";

export function sanitizeNickname(rawNickname: string): string {
  return rawNickname.trim().toLowerCase();
}

export function getSafeRedirectPath(rawPath: string | null | undefined): string {
  if (!rawPath || !rawPath.startsWith("/") || rawPath.startsWith("//")) {
    return ROUTES.dashboard;
  }

  return rawPath;
}
