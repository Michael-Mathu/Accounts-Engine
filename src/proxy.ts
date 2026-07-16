import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/", "/signin", "/signup", "/api/auth"];

export async function proxy(request: NextRequest) {
  const nextUrl = request.nextUrl;

  // Skip public paths and static files
  if (
    publicPaths.some((path) => nextUrl.pathname.startsWith(path)) ||
    nextUrl.pathname.startsWith("/_next") ||
    nextUrl.pathname.startsWith("/static") ||
    nextUrl.pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const session = await auth();

  if (!session) {
    const signInUrl = new URL("/auth/signin", nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};