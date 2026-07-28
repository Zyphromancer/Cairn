import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // PWA assets (manifest, service worker, icons) must be fetchable
    // with no session at all — the browser requests them to decide
    // installability, and the service worker fetches them itself
    // before any user is signed in. Excluded here rather than added to
    // updateSession's PUBLIC_PATHS since they need no auth-cookie
    // handling whatsoever, unlike /login and /auth/callback.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
