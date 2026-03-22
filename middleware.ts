import { NextResponse, type NextRequest } from "next/server";

import {
  ADMIN_ROUTE_PREFIX,
  AUTH_ROUTES,
  DEFAULT_REDIRECTS,
  PROTECTED_ROUTE_PREFIXES,
  ROUTES
} from "@/lib/constants/routes";
import { updateSession } from "@/lib/supabase/middleware";
import { isPathProtected } from "@/lib/utils";

function redirectWithCookies(
  request: NextRequest,
  sessionResponse: NextResponse,
  pathname: string,
  searchParams?: Record<string, string>
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  } else {
    url.search = "";
  }

  const response = NextResponse.redirect(url);
  sessionResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });

  return response;
}

export async function middleware(request: NextRequest) {
  const { response: sessionResponse, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const isProtected = isPathProtected(pathname, PROTECTED_ROUTE_PREFIXES);
  const isAuthRoute = AUTH_ROUTES.includes(pathname as (typeof AUTH_ROUTES)[number]);
  const isAdminRoute =
    pathname === ADMIN_ROUTE_PREFIX || pathname.startsWith(`${ADMIN_ROUTE_PREFIX}/`);

  if (!user && (isProtected || isAdminRoute)) {
    return redirectWithCookies(request, sessionResponse, ROUTES.login, { next: pathname });
  }

  if (user && isAuthRoute) {
    return redirectWithCookies(request, sessionResponse, DEFAULT_REDIRECTS.afterLogin);
  }

  return sessionResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
