import { type NextRequest, NextResponse } from "next/server"
import { AuthService } from "../auth"

export const withAuth = (handler: Function, requiredRoles?: string[]) => {
  return async (request: NextRequest, ...args: any[]) => {
    try {
      const token =
        request.headers.get("authorization")?.replace("Bearer ", "") ||
        request.cookies.get("auth-token")?.value

      if (!token) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }

      const user = AuthService.verifyToken(token)
      if (!user) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 })
      }

      // Check role permissions
      if (requiredRoles && !requiredRoles.includes(user.role)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
      }
      // Add user to request context
      const newRequest = new NextRequest(request.url, request)
      newRequest.headers.set("x-user", JSON.stringify(user))

      return await handler(newRequest, ...args)
    } catch (error) {
      console.error("Auth middleware error:", error)
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 })
    }
  }
}
