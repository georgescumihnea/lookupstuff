import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    console.log("Middleware - Request URL:", req.nextUrl.pathname);
    console.log("Middleware - Full Request:", req);

    // Handle admin routes
    if (req.nextUrl.pathname.startsWith("/admin")) {
      const token = req.nextauth.token;
      console.log(
        "Middleware - Full Token Object:",
        JSON.stringify(token, null, 2)
      );
      console.log("Middleware - Token Role Type:", typeof token?.role);
      console.log("Middleware - Token Role Value:", token?.role);

      if (!token?.role) {
        console.log("Access denied: No role found in token");
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }

      if (token.role !== "admin") {
        console.log(
          "Access denied: Role is not admin, found role:",
          token.role
        );
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }

      console.log("Access granted: User is admin");
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        console.log(
          "Middleware - Authorized callback token:",
          JSON.stringify(token, null, 2)
        );
        return !!token;
      },
    },
  }
);

// Make sure to include all protected routes
export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/admin"],
};
