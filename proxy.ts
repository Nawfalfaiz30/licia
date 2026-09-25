import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const APP_ROUTES = [
  "/dashboard", "/today", "/chat", "/tasks", "/pomodoro", "/focus", "/calendar", "/finance", "/health",
  "/goals", "/notes", "/reading", "/habits", "/subscriptions", "/inbox", "/projects", "/planner", "/brief",
  "/review", "/timeline", "/analytics", "/insights", "/decisions", "/learning", "/memory", "/vault",
  "/automations", "/life-map", "/life-graph", "/settings", "/reminders", "/relations", "/search", "/command",
  "/capture", "/pulse", "/ai-history", "/guide", "/system",
];

function isPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = isPath(pathname, "/login") || isPath(pathname, "/signup");
  const isAppRoute = APP_ROUTES.some((prefix) => isPath(pathname, prefix));

  if (!user && isAppRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*", "/today/:path*", "/chat/:path*", "/tasks/:path*", "/pomodoro/:path*", "/focus/:path*",
    "/calendar/:path*", "/finance/:path*", "/health/:path*", "/goals/:path*", "/notes/:path*", "/reading/:path*",
    "/habits/:path*", "/subscriptions/:path*", "/inbox/:path*", "/projects/:path*", "/planner/:path*", "/brief/:path*",
    "/review/:path*", "/timeline/:path*", "/analytics/:path*", "/insights/:path*", "/decisions/:path*", "/learning/:path*",
    "/memory/:path*", "/vault/:path*", "/automations/:path*", "/life-map/:path*", "/life-graph/:path*", "/settings/:path*",
    "/reminders/:path*", "/relations/:path*", "/search/:path*", "/command/:path*", "/capture/:path*", "/pulse/:path*",
    "/ai-history/:path*", "/guide/:path*", "/system/:path*", "/login", "/signup",
  ],
};
