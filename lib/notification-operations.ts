import type { ObjectId } from "mongodb"
import { connectToDatabase } from "./mongodb"
import type { Notification } from "./models/notification"

export interface NotificationPreferences {
  userId: ObjectId
  emailNotifications: boolean
  pushNotifications: boolean
  fileApprovalNotifications: boolean
  fileUploadNotifications: boolean
  systemAlertNotifications: boolean
  digestFrequency: "immediate" | "daily" | "weekly" | "never"
}

export async function createNotification(notification: Omit<Notification, "_id" | "createdAt" | "isRead">) {
  const { db } = await connectToDatabase()

  const newNotification: Notification = {
    ...notification,
    isRead: false,
    createdAt: new Date(),
  }

  const result = await db.collection("notifications").insertOne(newNotification)

  // Send real-time notification if user is online
  await sendRealTimeNotification(notification.userId, newNotification)

  // Send email notification if enabled
  await sendEmailNotification(notification.userId, newNotification)

  return result
}

export async function getUserNotifications(userId: ObjectId, limit = 50, skip = 0) {
  const { db } = await connectToDatabase()

  const notifications = await db
    .collection("notifications")
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .toArray()

  return notifications
}

export async function markNotificationAsRead(notificationId: ObjectId, userId: ObjectId) {
  const { db } = await connectToDatabase()

  const result = await db
    .collection("notifications")
    .updateOne({ _id: notificationId, userId }, { $set: { isRead: true } })

  return result
}

export async function markAllNotificationsAsRead(userId: ObjectId) {
  const { db } = await connectToDatabase()

  const result = await db.collection("notifications").updateMany({ userId, isRead: false }, { $set: { isRead: true } })

  return result
}

export async function getUnreadNotificationCount(userId: ObjectId) {
  const { db } = await connectToDatabase()

  const count = await db.collection("notifications").countDocuments({
    userId,
    isRead: false,
  })

  return count
}

export async function deleteNotification(notificationId: ObjectId, userId: ObjectId) {
  const { db } = await connectToDatabase()

  const result = await db.collection("notifications").deleteOne({
    _id: notificationId,
    userId,
  })

  return result
}

export async function getUserNotificationPreferences(userId: ObjectId): Promise<NotificationPreferences | null> {
  const { db } = await connectToDatabase()

  const preferences = await db.collection("notification_preferences").findOne({ userId })
  return preferences
}

export async function updateNotificationPreferences(userId: ObjectId, preferences: Partial<NotificationPreferences>) {
  const { db } = await connectToDatabase()

  const result = await db
    .collection("notification_preferences")
    .updateOne({ userId }, { $set: { ...preferences, userId } }, { upsert: true })

  return result
}

async function sendRealTimeNotification(userId: ObjectId, notification: Notification) {
  // In a real app, this would use WebSockets or Server-Sent Events
  // For now, we'll just log it
  console.log(`[Real-time] Notification sent to user ${userId}:`, notification.title)
}

async function sendEmailNotification(userId: ObjectId, notification: Notification) {
  const { db } = await connectToDatabase()

  // Get user preferences
  const preferences = await getUserNotificationPreferences(userId)
  if (!preferences?.emailNotifications) return

  // Get user email
  const user = await db.collection("users").findOne({ _id: userId })
  if (!user?.email) return

  // In a real app, this would integrate with an email service like SendGrid, Resend, etc.
  console.log(`[Email] Notification sent to ${user.email}:`, notification.title)

  // Store email log
  await db.collection("email_logs").insertOne({
    userId,
    email: user.email,
    subject: notification.title,
    content: notification.message,
    sentAt: new Date(),
    status: "sent",
  })
}

export async function cleanupExpiredNotifications() {
  const { db } = await connectToDatabase()

  const result = await db.collection("notifications").deleteMany({
    expiresAt: { $lt: new Date() },
  })

  return result
}
