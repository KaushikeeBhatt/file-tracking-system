import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getUserNotificationPreferences, updateNotificationPreferences } from "@/lib/notification-operations"
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

    const preferences = await getUserNotificationPreferences(new ObjectId(payload.userId))

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error("Get notification preferences error:", error)
    return NextResponse.json({ error: "Failed to fetch notification preferences" }, { status: 500 })
  }
}

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

    const preferences = await request.json()

    await updateNotificationPreferences(new ObjectId(payload.userId), preferences)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update notification preferences error:", error)
    return NextResponse.json({ error: "Failed to update notification preferences" }, { status: 500 })
  }
}
