import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getUnreadNotificationCount } from "@/lib/notification-operations"
import { ObjectId } from "mongodb"

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const count = await getUnreadNotificationCount(new ObjectId(payload.userId))

    return NextResponse.json({ count })
  } catch (error) {
    console.error("Get unread count error:", error)
    return NextResponse.json({ error: "Failed to fetch unread count" }, { status: 500 })
  }
}
