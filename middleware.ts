import { NextRequest, NextResponse } from "next/server";

const protectedApiPrefixes = ["/api/uploads"];
const adminWriteApiPrefixes = ["/api/ads", "/api/words"];

function isProtectedPath(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    return true;
  }

  if (protectedApiPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  if (adminWriteApiPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return request.method !== "GET";
  }

  if (pathname === "/api/notes") {
    return request.method !== "GET" || searchParams.get("status") !== "published";
  }

  if (pathname.startsWith("/api/notes/")) {
    return true;
  }

  return false;
}

function unauthorized(message = "需要後台帳號密碼") {
  return new NextResponse(message, {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="JapanNote Admin", charset="UTF-8"'
    }
  });
}

function getCredentials(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = atob(authorization.slice(6));
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  if (!isProtectedPath(request)) {
    return NextResponse.next();
  }

  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return new NextResponse("尚未設定 ADMIN_PASSWORD，後台已暫時鎖住。", { status: 503 });
  }

  const credentials = getCredentials(request);

  if (!credentials || credentials.username !== adminUsername || credentials.password !== adminPassword) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"]
};
