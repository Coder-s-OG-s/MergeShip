import { NextRequest, NextResponse } from "next/server";

// Routes that require an active Appwrite session
const PROTECTED_PATHS = [
  "/dashboard",
  "/achievements",
  "/community",
  "/issues",
  "/leaderboard",
  "/portfolio",
  "/profile",
  "/maintainer",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  // If the project ID env var is not configured, skip auth check (dev fallback)
  if (!projectId) return NextResponse.next();

  // Appwrite's web SDK stores the OAuth session as a cookie named a_session_<projectId>.
  // OAuth state generation and CSRF validation are handled internally by Appwrite.
  const cookieKey = `a_session_${projectId}`;
  const hasSession =
    request.cookies.has(cookieKey) || request.cookies.has(`${cookieKey}_legacy`);

  if (!hasSession) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/achievements/:path*",
    "/community/:path*",
    "/issues/:path*",
    "/leaderboard/:path*",
    "/portfolio/:path*",
    "/profile/:path*",
    "/maintainer/:path*",
  ],
};
