import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "@/lib/auth/session";

type Requirement = "admin" | "mesero" | "cocina" | "any" | null;

const SHARED_RESOURCES = ["/api/categorias", "/api/productos", "/api/mesas"];

function requiredSection(pathname: string, method: string): Requirement {
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) return "admin";
  if (pathname.startsWith("/api/dashboard")) return "admin";
  if (pathname.startsWith("/mesero") || pathname.startsWith("/api/mesero")) return "mesero";
  if (pathname.startsWith("/cocina") || pathname.startsWith("/api/cocina")) return "cocina";

  const isShared = SHARED_RESOURCES.some(
    (resource) => pathname === resource || pathname.startsWith(`${resource}/`)
  );
  if (isShared) {
    // Lectura disponible para cualquier sesión (mesero/admin); escritura solo admin.
    return method === "GET" || method === "HEAD" ? "any" : "admin";
  }

  if (pathname === "/dashboard") return "any";

  return null;
}

function hasAccess(session: SessionPayload, requirement: Requirement) {
  if (!requirement || requirement === "any") return true;
  return session.sections.includes(requirement);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const isApiRoute = pathname.startsWith("/api");

  const requirement = requiredSection(pathname, request.method);

  if (!session) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Debes iniciar sesión." },
        { status: 401 }
      );
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!hasAccess(session, requirement)) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No tienes permisos para esta sección." },
        { status: 403 }
      );
    }

    const home = session.home || "/dashboard";
    if (pathname === home) return NextResponse.next();
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/admin/:path*",
    "/mesero/:path*",
    "/cocina/:path*",
    "/api/admin/:path*",
    "/api/dashboard/:path*",
    "/api/mesero/:path*",
    "/api/cocina/:path*",
    "/api/categorias/:path*",
    "/api/productos/:path*",
    "/api/mesas/:path*",
  ],
};
