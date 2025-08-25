import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/auth"
import { AdminOperations } from "@/lib/admin-operations"

async function adminStatsHandler(request: NextRequest) {
  try {
    const stats = await AdminOperations.getSystemStats()
    return NextResponse.json({ stats })
  } catch (error) {
    console.error("Admin stats error:", error)
    return NextResponse.json({ error: "Failed to fetch system stats" }, { status: 500 })
  }
}

export const GET = withAuth(adminStatsHandler, ["admin"])
