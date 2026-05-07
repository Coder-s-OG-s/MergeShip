import { NextRequest, NextResponse } from "next/server";

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

  // Fail closed — never silently open protected routes on misconfiguration
  if (!endpoint || !projectId) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const cookieKey = `a_session_${projectId}`;
  const sessionValue =
    request.cookies.get(cookieKey)?.value ||
    request.cookies.get(`${cookieKey}_legacy`)?.value;

  if (!sessionValue) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Verify the session cryptographically against Appwrite rather than trusting
  // cookie presence alone — prevents forged-cookie bypass.
  try {
    const res = await fetch(`${endpoint}/account`, {
      headers: {
        "X-Appwrite-Project": projectId,
        Cookie: `${cookieKey}=${sessionValue}`,
      },
    });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  } catch {
    // Network error reaching Appwrite — pass through; API routes enforce auth independently.
  }

  return NextResponse.next();
}

// config.matcher must be a static literal in Next.js — dynamic expressions are ignored at build time.
// Keep this list in sync with PROTECTED_PATHS above.
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
