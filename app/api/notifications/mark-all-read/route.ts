import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { markAllNotificationsAsRead } from "@/lib/notification-operations"
import { ObjectId } from "mongodb"

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    await markAllNotificationsAsRead(new ObjectId(payload.userId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Mark all notifications as read error:", error)
    return NextResponse.json({ error: "Failed to mark all notifications as read" }, { status: 500 })
  }
}
