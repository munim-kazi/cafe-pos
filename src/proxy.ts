import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === "/login";
  const isApiAuth = pathname.startsWith("/api/auth");

  if (isApiAuth) return NextResponse.next();

  if (!token && !isAuthPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const roleHierarchy: Record<string, number> = {
    ADMIN: 4,
    MANAGER: 3,
    CASHIER: 2,
    KITCHEN: 1,
  };

  const routeAccess: Record<string, string> = {
    "/dashboard/pos": "CASHIER",
    "/dashboard/orders": "CASHIER",
    "/dashboard/tables": "CASHIER",
    "/dashboard/menu": "MANAGER",
    "/dashboard/inventory": "MANAGER",
    "/dashboard/accounting": "ADMIN",
    "/dashboard/reports": "ADMIN",
    "/dashboard/settings": "ADMIN",
    "/dashboard/staff": "ADMIN",
  };

  if (token) {
    const userRole = token.role as string;
    const userLevel = roleHierarchy[userRole] ?? 0;

    for (const [route, requiredRole] of Object.entries(routeAccess)) {
      if (pathname.startsWith(route)) {
        const requiredLevel = roleHierarchy[requiredRole] ?? 0;
        if (userLevel < requiredLevel) {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
        break;
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
};
